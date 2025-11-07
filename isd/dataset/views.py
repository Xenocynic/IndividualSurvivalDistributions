from django.db.models import Q
from django.db import transaction, DatabaseError
from django.http import HttpResponse, Http404
from django.core.files.storage import default_storage
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.exceptions import PermissionDenied
from .models import Dataset, DatasetPermission, PinnedDataset
from .serializers import (
    DatasetSerializer,
    DatasetPermissionSerializer,
    PinnedDatasetSerializer,
    DatasetStatisticsSerializer,
)
from .file_utils import FileStorageManager
from .tasks import process_feature_imputation
from .statistics import ensure_dataset_statistics
import os
import mimetypes
import pandas as pd
import logging
from django.conf import settings
from predictors.models import Predictor
from predictors.serializers import PredictorSerializer
from predictors.views import CanAccessPredictor

# ----------------------------
# Custom Permissions
# ----------------------------
class IsDatasetOwner(permissions.BasePermission):
    """Only dataset owners / superuser can update/delete"""
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user or request.user.is_superuser


class CanAccessDataset(permissions.BasePermission):
    """Allow view if owner / superuser, has permission or dataset is public"""
    def has_object_permission(self, request, view, obj):
        # Superusers have access to all datasets
        if request.user.is_superuser:
            return True
        # Owner always has access
        if obj.owner == request.user:
            return True
        if obj.is_public:
            return True
        # Other users can access only if a DatasetPermission exists
        return DatasetPermission.objects.filter(dataset=obj, user=request.user).exists()

# ----------------------------
# Dataset ViewSet
# ----------------------------
@extend_schema_view(
    list=extend_schema(
        summary="List all datasets",
        description="Retrieve a list of all datasets the user has access to.",
        tags=["Datasets"]
    ),
    create=extend_schema(
        summary="Create a new dataset",
        description="Create a new dataset with file upload. The authenticated user becomes the owner. Supports multipart form data for file uploads.",
        tags=["Datasets"]
    ),
    retrieve=extend_schema(
        summary="Get dataset details",
        description="Retrieve detailed information about a specific dataset.",
        tags=["Datasets"]
    ),
    update=extend_schema(
        summary="Update dataset",
        description="Update all fields of a dataset. Only the owner can update.",
        tags=["Datasets"]
    ),
    partial_update=extend_schema(
        summary="Partially update dataset",
        description="Update specific fields of a dataset. Only the owner can update.",
        tags=["Datasets"]
    ),
    destroy=extend_schema(
        summary="Delete dataset",
        description="Delete a dataset and its associated file. Only the owner can delete. This action cannot be undone.",
        tags=["Datasets"]
    ),
    download_file=extend_schema(
        summary="Download dataset file",
        description="Download the file associated with a dataset. Only users with access to the dataset can download the file.",
        tags=["Datasets"],
        responses={
            200: {
                'description': 'File download',
                'content': {
                    'text/csv': {'schema': {'type': 'string', 'format': 'binary'}},
                    'text/tab-separated-values': {'schema': {'type': 'string', 'format': 'binary'}},
                }
            },
            403: {'description': 'Permission denied'},
            404: {'description': 'Dataset or file not found'},
        }
    ),
)

class DatasetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing datasets.
    Provides CRUD operations for datasets with proper ownership and permission checks.
    Supports file uploads through multipart form data.
    """
    serializer_class = DatasetSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        """
        Return datasets that the user owns or has permission to access.
        Supports folder filtering via query parameters.
        Uses Q objects for efficiency and correctness.
        """
        user = self.request.user

        if user.is_superuser:
            return Dataset.objects.all().order_by("dataset_name")
        
        queryset = (
            Dataset.objects.filter(
                Q(owner=user) | Q(permissions__user=user)
            )
            .distinct()
            .order_by("dataset_name")
        )
        
        # Support folder filtering
        folder_id = self.request.query_params.get('folder_id')
        if folder_id is not None:
            if folder_id == 'null' or folder_id == '':
                # Filter for items not in any folder
                from folders.models import FolderItem
                from django.contrib.contenttypes.models import ContentType
                
                dataset_ct = ContentType.objects.get_for_model(Dataset)
                items_in_folders = FolderItem.objects.filter(
                    content_type=dataset_ct
                ).values_list('object_id', flat=True)
                
                queryset = queryset.exclude(dataset_id__in=items_in_folders)
            else:
                # Filter for items in specific folder
                try:
                    folder_id = int(folder_id)
                    from folders.models import FolderItem
                    from django.contrib.contenttypes.models import ContentType
                    
                    dataset_ct = ContentType.objects.get_for_model(Dataset)
                    items_in_folder = FolderItem.objects.filter(
                        folder_id=folder_id,
                        content_type=dataset_ct
                    ).values_list('object_id', flat=True)
                    
                    queryset = queryset.filter(dataset_id__in=items_in_folder)
                except (ValueError, TypeError):
                    # Invalid folder_id, return empty queryset
                    queryset = queryset.none()
        
        return queryset

    def get_object(self):
        """
        Override to run permission checks first, so unauthorized users get 403 instead of 404.
        (Basically sends 403 to let us know object exists, user just doesn't have access)
        """
        # Get the object from all datasets, not just the filtered queryset
        queryset = Dataset.objects.all()
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        
        try:
            obj = queryset.get(**filter_kwargs)
        except Dataset.DoesNotExist:
            from django.http import Http404
            raise Http404("No Dataset matches the given query.")
        
        self.check_object_permissions(self.request, obj)
        return obj

    def get_permissions(self):
        """
        Assign permissions based on the action:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or user with permission
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsDatasetOwner()]
        elif self.action == "retrieve":
            return [CanAccessDataset()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        """
        Create a new dataset with file upload support.
        Automatically performs feature imputation on the uploaded data.
        
        Handles multipart form data and implements transaction management
        for atomic operations with proper error handling and rollback.
        """
        serializer = self.get_serializer(data=request.data)
        
        try:
            # Validate the serializer data
            serializer.is_valid(raise_exception=True)
            
            # Use atomic transaction to ensure consistency
            with transaction.atomic():
                # The serializer's create method handles file processing
                dataset = serializer.save()
                
                # Automatically perform feature imputation
                imputation_result = None
                processing_warnings = []

                if dataset.file_path:
                    try:
                        imputation_result = process_feature_imputation(dataset.dataset_id)
                        if imputation_result.get('warnings'):
                            processing_warnings = imputation_result['warnings'] # Capture warnings
                        if imputation_result['success']:
                            pass
                        else:
                            # If processing failed, raise an error to roll back the transaction
                            raise Exception(imputation_result.get('error', 'Data processing failed.'))
                    except Exception as imputation_error:
                        # Log the error but don't fail the dataset creation
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Auto-imputation failed for dataset {dataset.dataset_id}: {str(imputation_error)}")
                
                # Prepare response data
                response_data = serializer.data
                
                # Add processing details and warnings to the response
                response_data['processing_details'] = imputation_result.get('details')
                response_data['warnings'] = processing_warnings # Add warnings here

                headers = self.get_success_headers(response_data)
                return Response(
                    response_data,
                    status=status.HTTP_201_CREATED,
                    headers=headers
                )
                
        except Exception as e:
            # Handle any errors that occur during creation
            # The serializer's create method handles file cleanup
            
            # If it's a validation error, return the validation errors
            if hasattr(e, 'detail'):
                return Response(
                    {'error': 'Validation failed', 'details': e.detail},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # For other errors, return a generic error message
            return Response(
                {
                    'error': 'Dataset creation failed',
                    'message': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        """
        Delete a dataset and its associated file.
        
        The model's delete() method handles file cleanup automatically.
        """
        try:
            # Get the instance (this checks permissions and raises Http404 if not found)
            instance = self.get_object()
            
            # Use transaction to ensure atomicity
            with transaction.atomic():
                # The model's delete() method handles file cleanup
                self.perform_destroy(instance)
                
                return Response(status=status.HTTP_204_NO_CONTENT)
                
        except (Http404, PermissionDenied):
            # Let DRF handle these exceptions properly
            raise
        except Exception as e:
            return Response(
                {
                    'error': 'Dataset deletion failed',
                    'message': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], url_path='download')
    def download_file(self, request, pk=None):
        """
        Download the dataset file.
        
        Provides secure file serving with permission checks and proper HTTP headers.
        Only authorized users (owner or users with permission) can download files.
        """
        try:
            # Get the dataset instance (this will check permissions via get_object)
            dataset = self.get_object()
            
            # Check if dataset has a file
            if not dataset.file_path:
                return Response(
                    {'error': 'No file associated with this dataset'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if file exists in storage
            storage_manager = FileStorageManager()
            if not storage_manager.file_exists(dataset.file_path):
                return Response(
                    {'error': 'File not found in storage'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get the file from storage
            try:
                file_obj = default_storage.open(dataset.file_path, 'rb')
            except Exception as e:
                return Response(
                    {'error': f'Error accessing file: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Determine content type
            content_type, _ = mimetypes.guess_type(dataset.original_filename or dataset.file_path)
            if not content_type:
                # Default to CSV for dataset files
                if dataset.file_path.lower().endswith('.tsv'):
                    content_type = 'text/tab-separated-values'
                else:
                    content_type = 'text/csv'
            
            # Create HTTP response with proper headers
            response = HttpResponse(file_obj.read(), content_type=content_type)
            
            # Set filename for download
            filename = dataset.original_filename or f"dataset_{dataset.dataset_id}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Set additional headers
            response['Content-Length'] = dataset.file_size or storage_manager.get_file_size(dataset.file_path)
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            
            # Close the file
            file_obj.close()
            
            return response
            
        except Http404:
            return Response(
                {'error': 'Dataset not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionDenied:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': f'File download failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=True,
        methods=['get'],
        url_path='stats',
        serializer_class=DatasetStatisticsSerializer,
    )
    def statistics(self, request, pk=None):
        """
        Return cached statistics for this dataset, recalculating if requested.
        """
        dataset = self.get_object()
        if not dataset.file_path:
            return Response(
                {'error': 'Dataset has no associated file – cannot compute statistics.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh_flag = request.query_params.get('refresh', '').lower()
        force_recalculate = refresh_flag in ('1', 'true', 'yes', 'recompute', 'refresh')

        try:
            result = ensure_dataset_statistics(
                dataset,
                force_recalculate=force_recalculate,
            )
        except DatabaseError as exc:
            logger = logging.getLogger(__name__)
            logger.error(
                "Dataset statistics backend unavailable for %s: %s",
                dataset.dataset_id,
                exc,
                exc_info=True,
            )
            return Response(
                {
                    'error': 'Dataset statistics storage is unavailable. Please run the latest migrations to initialize analytics.',
                    'code': 'stats_backend_unavailable',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            logger = logging.getLogger(__name__)
            logger.error(
                "Failed to compute dataset statistics for %s: %s",
                dataset.dataset_id,
                exc,
                exc_info=True,
            )
            return Response(
                {'error': f'Failed to compute statistics: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DatasetStatisticsSerializer(result.stats)
        data = serializer.data
        general = data.get('general_stats') or {}
        total_columns = general.get('total_columns')
        columns = int(total_columns) if total_columns is not None else None
        data['dataframe_metadata'] = {
            'columns': columns if columns is not None else 0,
            'rows': int(general.get('num_samples') or 0),
        }
        return Response(data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        """Automatically assign the authenticated user as the dataset owner."""
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        """
        Pin a dataset for quick access.
        Only allowed if the user can access the dataset.
        """
        dataset = self.get_object()
        if not CanAccessDataset().has_object_permission(request, self, dataset):
            raise PermissionDenied("You do not have permission to pin this dataset.")
        PinnedDataset.objects.get_or_create(user=request.user, dataset=dataset)
        return Response({"status": "pinned"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unpin(self, request, pk=None):
        """
        Unpin a dataset.
        Only allowed if the user can access the dataset.
        """
        dataset = self.get_object()
        if not CanAccessDataset().has_object_permission(request, self, dataset):
            raise PermissionDenied("You do not have permission to unpin this dataset.")
        PinnedDataset.objects.filter(user=request.user, dataset=dataset).delete()
        return Response({"status": "unpinned"}, status=status.HTTP_200_OK)
    
    def retrieve(self, request, *args, **kwargs):
        """
        Custom retrieve method to add feature and label counts to the response.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        # Initialize counts
        num_features = None
        num_labels = None

        try:
            if instance.file_path:
                # Construct the full path to the file
                full_file_path = os.path.join(settings.MEDIA_ROOT, instance.file_path)
                
                if os.path.exists(full_file_path):
                    # Open in binary read mode and let pandas read it
                    with open(full_file_path, 'rb') as f:
                        df = pd.read_csv(f)
                    
                    # Calculate num_labels (rows - header)
                    num_labels = len(df)
                    
                    # Calculate num_features (cols - 2)
                    num_cols = len(df.columns)
                    num_features = num_cols - 2 if num_cols >= 2 else 0
                
        except Exception as e:
            # Log the error but don't fail the request
            print(f"Error reading CSV for dataset {instance.dataset_id}: {e}")

        # Add the counts to the serialized data
        data['num_features'] = num_features
        data['num_labels'] = num_labels
        
        return Response(data)

    @action(detail=True, methods=['get'], url_path='predictors')
    def list_predictors(self, request, pk=None):
        """
        List all predictors (public or accessible by the user)
        that are associated with this dataset.
        """
        #    Get the dataset object. This automatically runs
        #    CanAccessDataset permission check, so a user can't
        #    see predictors for a dataset they don't have access to.
        try:
            dataset = self.get_object() 
        except Exception as e:
            return Response({"error": "Dataset not found or permission denied."}, status=status.HTTP_404_NOT_FOUND)

        #    Get all predictors linked to this dataset
        all_predictors_on_dataset = Predictor.objects.filter(
            dataset=dataset
        ).order_by('-updated_at')

        #    Filter this list to only what the user can see
        #    We must manually check each predictor's permissions
        accessible_predictors = []
        predictor_permission_check = CanAccessPredictor()
        for predictor in all_predictors_on_dataset:
            if predictor_permission_check.has_object_permission(request, self, predictor):
                accessible_predictors.append(predictor)

        #    Serialize the final list of accessible predictors
        #    (We can add backend pagination here later if lists get very long)
        serializer = PredictorSerializer(accessible_predictors, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ----------------------------
# Dataset Permission ViewSet
# ----------------------------
@extend_schema_view(
    list=extend_schema(
        summary="List dataset permissions",
        description="List all users who have access to datasets owned by the authenticated user.",
        tags=["Dataset Permissions"]
    ),
    create=extend_schema(
        summary="Grant dataset access",
        description="Grant a user access to a specific dataset (only the owner can do this).",
        tags=["Dataset Permissions"]
    ),
    destroy=extend_schema(
        summary="Revoke dataset access",
        description="Revoke a user's access to a dataset (only the owner can do this).",
        tags=["Dataset Permissions"]
    ),
)

class DatasetPermissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing dataset permissions.
    Allows dataset owners to grant or revoke access to their datasets.
    """
    serializer_class = DatasetPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Only return permissions for datasets owned by the current user.
        Prevents non-owners from viewing or modifying other users' dataset permissions.
        """
        return DatasetPermission.objects.filter(dataset__owner=self.request.user)

    def perform_create(self, serializer):
        """
        Only the dataset owner can grant access to others.
        Raises PermissionDenied if the request user is not the owner.
        """
        dataset = serializer.validated_data["dataset"]
        if dataset.owner != self.request.user:
            raise PermissionDenied("Only the dataset owner can grant access.")
        serializer.save()

    def perform_destroy(self, instance):
        """
        Only the dataset owner can revoke access.
        Raises PermissionDenied if the request user is not the owner.
        """
        if instance.dataset.owner != self.request.user:
            raise PermissionDenied("Only the dataset owner can revoke access.")
        instance.delete()

class PinnedDatasetViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing pinned datasets.
    - GET: list pinned datasets
    - POST: pin a dataset
    - DELETE: unpin a dataset
    """
    serializer_class = PinnedDatasetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Return datasets pinned by the current user.
        """
        return PinnedDataset.objects.filter(user=self.request.user).order_by("-pinned_at")

    def perform_create(self, serializer):
        """Automatically assign the current user when pinning"""
        serializer.save(user=self.request.user)


# ----------------------------
# Public Dataset Views
# ----------------------------
@extend_schema(
    summary="List public datasets",
    description="Retrieve a list of all public datasets. No authentication required.",
    tags=["Public Datasets"]
)
@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def list_public_datasets(request):
    """
    List all public datasets without authentication.
    Returns only datasets where is_public=True.
    """
    try:
        # Get all public datasets
        public_datasets = Dataset.objects.filter(is_public=True).order_by('-uploaded_at')
        
        # Serialize the data
        serializer = DatasetSerializer(public_datasets, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {
                'error': 'Failed to fetch public datasets',
                'message': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
