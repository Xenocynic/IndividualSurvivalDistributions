from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Predictor, PredictorPermission, PinnedPredictor
from .serializers import PredictorSerializer, PredictorPermissionSerializer, PinnedPredictorSerializer
from .ml_client import MLAPIClient
import pandas as pd
import os
import requests
import json
from django.conf import settings
from django.utils import timezone

# ----------------------------
# Custom Permissions
# ----------------------------
class IsPredictorOwner(permissions.BasePermission):
    """Only predictor owners / superusers can update/delete"""
    def has_object_permission(self, request, view, obj):
        if obj.owner == request.user or request.user.is_superuser:
            return True
        # Users assigned as 'owner' in permissions
        return PredictorPermission.objects.filter(
            predictor=obj, user=request.user, role='owner'
        ).exists()


class CanAccessPredictor(permissions.BasePermission):
    """Allow view if owner / superuser, has permission, or predictor is public"""
    def has_object_permission(self, request, view, obj):
        # Superusers have access to all predictors
        if request.user.is_superuser:
            return True
        
        # Owner always has access
        if obj.owner == request.user:
            return True
        # Users can access public predictors
        if not obj.is_private:
            return True
        if PredictorPermission.objects.filter(predictor=obj, user=request.user).exists():
            return True
        return False


# ----------------------------
# Predictor ViewSet
# ----------------------------
class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model with proper access control."""

    serializer_class = PredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns predictors the user owns, has been granted access to, or are public.
        Supports folder filtering via query parameters.
        - Owned predictors: user is the owner
        - Shared predictors: user has PredictorPermission
        - Public predictors: is_private=False
        """
        user = self.request.user

        if user.is_superuser:
            return Predictor.objects.all().prefetch_related("permissions", "pinned_by").order_by("name")

        queryset = (
            Predictor.objects.filter(Q(owner=user) | Q(permissions__user=user))
            .distinct()
            .prefetch_related("permissions", "pinned_by")
            .order_by("name")
        )
        
        # Support folder filtering
        folder_id = self.request.query_params.get('folder_id')
        print(folder_id)
        if folder_id is not None:
            if folder_id == 'null' or folder_id == '':
                # Filter for items not in any folder
                from folders.models import FolderItem
                from django.contrib.contenttypes.models import ContentType
                
                predictor_ct = ContentType.objects.get_for_model(Predictor)
                items_in_folders = FolderItem.objects.filter(
                    content_type=predictor_ct
                ).values_list('object_id', flat=True)
                
                queryset = queryset.exclude(predictor_id__in=items_in_folders)
            else:
                # Filter for items in specific folder
                try:
                    folder_id = int(folder_id)
                    from folders.models import FolderItem
                    from django.contrib.contenttypes.models import ContentType
                    
                    predictor_ct = ContentType.objects.get_for_model(Predictor)
                    items_in_folder = FolderItem.objects.filter(
                        folder_id=folder_id,
                        content_type=predictor_ct
                    ).values_list('object_id', flat=True)
                    
                    queryset = queryset.filter(predictor_id__in=items_in_folder)
                except (ValueError, TypeError):
                    # Invalid folder_id, return empty queryset
                    queryset = queryset.none()
        
        return queryset

    def get_object(self):
        """
        Override to run permission checks first, so unauthorized users get 403 instead of 404.
        (Basically sends 403 to let us know object exists, user just doesn't have access)
        """
        # Get the object from all predictors, not just the filtered queryset
        queryset = Predictor.objects.all()
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        
        try:
            obj = queryset.get(**filter_kwargs)
        except Predictor.DoesNotExist:
            from django.http import Http404
            raise Http404("No Predictor matches the given query.")
        
        self.check_object_permissions(self.request, obj)
        return obj

    def get_permissions(self):
        """
        Assign permissions based on the action being performed:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or shared
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsPredictorOwner()]
        elif self.action == "retrieve":
            return [CanAccessPredictor()]
        return super().get_permissions()


    def perform_create(self, serializer):
        """Assign the logged-in user as the owner and handle folders + permissions."""
        print("RAW request.data:", self.request.data)

        # Save predictor instance, attaching owner
        predictor = serializer.save(owner=self.request.user)

        # -------------------------
        # Handle folder (multi-model)
        # -------------------------
        folder = serializer.validated_data.get('folder')  # This is a Folder instance or None
        if folder:
            from folders.models import FolderItem
            from django.contrib.contenttypes.models import ContentType

            FolderItem.objects.create(
                content_type=ContentType.objects.get_for_model(Predictor),
                object_id=predictor.predictor_id,
                folder=folder,
                added_by=self.request.user
            )
            print(f"Predictor {predictor.predictor_id} added to folder {folder.folder_id}")

        # -------------------------
        # Automatically create 'owner' permission
        # -------------------------
        perm = PredictorPermission.objects.create(
            predictor=predictor,
            user=self.request.user,
            role='owner'
        )
        print("Owner permission added:", perm)

        # -------------------------
        # Add extra permissions from request
        # -------------------------
        try:
            permissions_data = self.request.data.get("permissions", [])
            for perm_data in permissions_data:
                username = perm_data.get("username")
                role = perm_data.get("role")
                if not username or role not in ["owner", "viewer"]:
                    print("Skipping invalid permission:", perm_data)
                    continue
                try:
                    user = User.objects.get(username=username)
                except User.DoesNotExist:
                    print("User not found:", username)
                    continue
                try:
                    p, created = PredictorPermission.objects.update_or_create(
                        predictor=predictor,
                        user=user,
                        defaults={"role": role}
                    )
                    print(f"Added/updated permission for {username}: {p}, created={created}")
                except Exception as e:
                    print("Failed to add permission:", perm_data, e)
        except Exception as e:
            print("perform_create failed:", e)


    def retrieve(self, request, *args, **kwargs):
        """
        Custom retrieve method to add dataset features to the response.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        try:
            if instance.dataset and instance.dataset.file_path:
                full_file_path = os.path.join(settings.MEDIA_ROOT, instance.dataset.file_path)
                
                # Check if the file actually exists before trying to open it
                if os.path.exists(full_file_path):
                    # Open the file using its full path
                    with open(full_file_path, 'rb') as f:
                        df = pd.read_csv(f, nrows=0)
                    data['features'] = df.columns.tolist()
                else:
                    print(f"File not found at path: {full_file_path}")
                    data['features'] = []
            else:
                data['features'] = []
        except Exception as e:
            print(f"Could not read features for predictor {instance.predictor_id}: {e}")
            data['features'] = []
        
        return Response(data)

    @action(detail=True, methods=["post"])
    def pin(self, request, pk=None):
        """
        Pin a predictor for quick access.
        Only allowed if the user can access the predictor.
        """
        predictor = self.get_object()
        if not CanAccessPredictor().has_object_permission(request, self, predictor):
            raise PermissionDenied("You do not have permission to pin this predictor.")
        PinnedPredictor.objects.get_or_create(user=request.user, predictor=predictor)
        return Response({"status": "pinned"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def unpin(self, request, pk=None):
        """
        Unpin a predictor.
        Only allowed if the user can access the predictor.
        """
        predictor = self.get_object()
        if not CanAccessPredictor().has_object_permission(request, self, predictor):
            raise PermissionDenied("You do not have permission to unpin this predictor.")
        PinnedPredictor.objects.filter(user=request.user, predictor=predictor).delete()
        return Response({"status": "unpinned"}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='train')
    def train(self, request, pk=None):
        """
        Triggers the training job on the separate ML API.
        This acts as a proxy, sending the dataset and parameters
        to the ML service.
        """
        try:
            predictor = self.get_object()
            dataset = predictor.dataset
            
            if not dataset or not dataset.file_path:
                return Response(
                    {"error": "Predictor has no associated dataset file."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            full_file_path = os.path.join(settings.MEDIA_ROOT, dataset.file_path)
            if not os.path.exists(full_file_path):
                return Response(
                    {"error": f"Dataset file not found at path: {full_file_path}"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # --- Prepare data for the ML API ---
            with open(full_file_path, 'rb') as f:
                df = pd.read_csv(f, nrows=0) # Read only header
            
            all_cols = df.columns.tolist()
            if len(all_cols) < 3:
                raise Exception("Dataset must have at least 3 columns (time, event, features).")

            time_col = all_cols[0]
            event_col = all_cols[1]
            
            # Get features and parameters from the request payload
            payload = request.data
            features = payload.get('features', all_cols[2:]) # Default to all features if not provided
            parameters = payload.get('settings', {})

            # Get ML API URL from environment variables
            ml_api_url = os.environ.get("ML_API_URL", "http://localhost:5001")
            train_url = f"{ml_api_url}/train"

            # Prepare the payload for the ML API
            params_for_ml = {
                'features': json.dumps(features),
                'time_col': time_col,
                'event_col': event_col,
                'parameters': json.dumps(parameters) # Send the new parameters
            }

            with open(full_file_path, 'rb') as f_bin:
                files = {'dataset': (dataset.original_filename, f_bin, 'text/csv')}
                
                # Make the server-to-server request
                ml_response = requests.post(train_url, data=params_for_ml, files=files, timeout=600)

            if ml_response.ok:
                # Training started successfully
                ml_data = ml_response.json()
                
                return Response(ml_data, status=status.HTTP_200_OK)
            else:
                # The ML API returned an error
                return Response(
                    {"error": "ML API training failed", "details": ml_response.text},
                    status=ml_response.status_code
                )
        
        except Exception as e:
            return Response(
                {"error": "Failed to call training API", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    

# ----------------------------
# PredictorPermission ViewSet
# ----------------------------
class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model with proper access control."""

    serializer_class = PredictorPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Only show permissions for predictors the current user owns.
        This ensures a user cannot see or modify permissions for predictors they don't own.
        """
        return PredictorPermission.objects.filter(predictor__owner=self.request.user)

    def perform_create(self, serializer):
        """
        Assign the logged-in user as the owner and optionally
        add extra permissions from the request data.
        Expects request.data to include 'permissions' key:
        [
            {"username": "alice", "role": "owner"},
            {"username": "bob", "role": "viewer"}
        ]
        """
        # Save predictor with the creator as owner
        print("RAW request.data:", self.request.data)
        serializer.save()

    def perform_destroy(self, instance):
        """
        Ensure only the predictor owner can revoke access.
        Raises PermissionDenied if the request user is not the owner.
        """
        if instance.predictor.owner != self.request.user:
            raise PermissionDenied("Only the predictor owner can revoke access.")
        instance.delete()

# ----------------------------
# PinnedPredictor ViewSet
# ----------------------------
class PinnedPredictorViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing pinned predictors.
    - GET: list pinned predictors
    - POST: pin a predictor
    - DELETE: unpin a predictor
    """
    serializer_class = PinnedPredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Return predictors pinned by the current user.
        """
        return PinnedPredictor.objects.filter(user=self.request.user).order_by("-pinned_at")

    def perform_create(self, serializer):
        """Automatically assign the current user when pinning"""
        serializer.save(user=self.request.user)

        
# ----------------------------
# Public Predictor Views
# ----------------------------
@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def list_public_predictors(request):
    """
    List all public predictors without authentication.
    Returns only predictors where is_private=False.
    """
    try:
        # Get all public predictors (where is_private=False)
        public_predictors = Predictor.objects.filter(is_private=False).order_by('name')
        
        # Serialize the data
        serializer = PredictorSerializer(public_predictors, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {
                'error': 'Failed to fetch public predictors',
                'message': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def resolve_username(request):
    username = request.query_params.get("username")
    if not username:
        return Response({"detail": "username required"}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(username=username).first()
    if not user:
        return Response({"detail": "User not found"}, status=404)
    return Response({"id": user.id})


# ========================================
# ML API Integration Views
# ========================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def ml_health_check(request):
    """
    Check if ML API is available
    GET /api/predictors/ml/health/
    """
    client = MLAPIClient()
    result = client.health_check()
    
    if result['status'] == 'healthy':
        return Response(result, status=status.HTTP_200_OK)
    else:
        return Response(result, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ml_train_model(request):
    """
    Train a new survival analysis model
    POST /api/predictors/ml/train/
    
    Request:
        - dataset: File (CSV)
        - selected_features: JSON array of feature names (optional)
        - parameters: JSON object with model parameters (optional)
        - return_cv_predictions: boolean (optional, default true)
    
    Response:
        - model_id: str
        - metrics: dict
        - cv_predictions: dict (if requested)
    """
    # print(f"📦 Predictor ID received in Django view: {predictor_id}")

    # Validate file upload
    if 'dataset' not in request.FILES:
        return Response(
            {'error': 'No dataset file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    dataset_file = request.FILES['dataset']
    
    # Validate file type
    if not dataset_file.name.endswith('.csv'):
        return Response(
            {'error': 'Dataset must be a CSV file'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get optional parameters
    selected_features = request.data.get('selected_features', None)
    parameters = request.data.get('parameters', None)
    return_cv = request.data.get('return_cv_predictions', True)
    
    # Parse if JSON strings
    import json
    if isinstance(selected_features, str):
        try:
            selected_features = json.loads(selected_features)
        except json.JSONDecodeError:
            return Response(
                {'error': 'selected_features must be valid JSON'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    if isinstance(parameters, str):
        try:
            parameters = json.loads(parameters)
        except json.JSONDecodeError:
            return Response(
                {'error': 'parameters must be valid JSON'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Call ML API
    client = MLAPIClient()
    result = client.train_model(
        dataset_file=dataset_file,
        selected_features=selected_features,
        parameters=parameters,
        return_cv_predictions=return_cv,
    )
    
    if result['success']:
        return Response(result['data'], status=status.HTTP_200_OK)
    else:
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ml_retrain_model(request):
    """
    Retrain an existing predictor model with a new dataset.
    """
    try:
        client = MLAPIClient()

        model_id = request.data.get("model_id")
        selected_features = request.data.get("selected_features")
        parameters = request.data.get("parameters")
        return_cv_predictions = request.data.get("return_cv_predictions", True)

        if not model_id:
            return Response({"error": "model_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Call ML API retrain
        result = client.retrain_model(
            model_id=model_id,
            selected_features=selected_features,
            parameters=parameters,
            return_cv_predictions=return_cv_predictions,
        )

        if not result.get("success"):
            return Response(
                {"error": result.get("error", "Retraining failed")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # If this retraining is tied to a Predictor, update metadata
        predictor = Predictor.objects.filter(ml_model_id=model_id).first()
        if predictor:
            data = result.get("data", {})
            predictor.ml_model_id = data.get("model_id", model_id)
            predictor.ml_trained_at = timezone.now()
            predictor.ml_training_status = "trained"
            predictor.ml_model_metrics = data.get("metrics", {})
            predictor.ml_selected_features = selected_features or predictor.ml_selected_features
            predictor.save(update_fields=[
                "ml_model_id", "ml_trained_at", "ml_training_status",
                "ml_model_metrics", "ml_selected_features"
            ])

        return Response(result.get("data"), status=status.HTTP_200_OK)

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"error": f"Retraining failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ml_predict(request):
    """
    Make predictions using a trained model
    POST /api/predictors/ml/predict/
    
    Request:
        - model_id: str (required)
        - features: dict of feature_name -> value (required)
    
    Response:
        - predictions: {
            median_survival_time: float,
            quantile_levels: list,
            quantile_predictions: list
          }
    """
    model_id = request.data.get('model_id')
    features = request.data.get('features')
    
    if not model_id:
        return Response(
            {'error': 'model_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not features or not isinstance(features, dict):
        return Response(
            {'error': 'features must be a dictionary of feature_name -> value'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    client = MLAPIClient()
    result = client.predict(model_id=model_id, features=features)
    
    if result['success']:
        return Response(result['data'], status=status.HTTP_200_OK)
    else:
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def ml_list_models(request):
    """
    List all trained models from ML API
    GET /api/predictors/ml/models/
    
    Response:
        - count: int
        - models: list of model info
    """
    client = MLAPIClient()
    result = client.list_models()
    
    if result['success']:
        return Response(result['data'], status=status.HTTP_200_OK)
    else:
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def predict_with_predictor(request, predictor_id):
    """
    Make a prediction using a trained predictor
    POST /api/predictors/{predictor_id}/predict/
    
    Request body:
        - features: Dict of feature_name -> value
    
    Response:
        - predictions: Survival predictions from ML model
    """
    try:
        predictor = Predictor.objects.get(predictor_id=predictor_id)
        
        # Check permissions
        if not CanAccessPredictor().has_object_permission(request, None, predictor):
            raise PermissionDenied("You don't have permission to use this predictor")
        
        # Check if model is trained
        if not predictor.ml_model_id:
            return Response(
                {'error': 'This predictor has not been trained yet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if predictor.ml_training_status != 'trained':
            return Response(
                {'error': f'Model is not ready (status: {predictor.ml_training_status})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get features from request
        features = request.data.get('features')
        if not features or not isinstance(features, dict):
            return Response(
                {'error': 'features must be a dictionary of feature_name -> value'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Make prediction using ML API
        client = MLAPIClient()
        result = client.predict(
            model_id=predictor.ml_model_id,
            features=features
        )
        
        if result['success']:
            return Response(result['data'], status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': result['error']},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Predictor.DoesNotExist:
        return Response(
            {'error': 'Predictor not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Prediction failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )