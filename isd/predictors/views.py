from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from .models import Predictor, PredictorPermission
from rest_framework.exceptions import PermissionDenied
from .serializers import PredictorSerializer, PredictorPermissionSerializer
from django.db.models import Q

# ----------------------------
# Custom Permissions
# ----------------------------
class IsPredictorOwner(permissions.BasePermission):
    """Only predictor owners can update/delete"""
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class CanAccessPredictor(permissions.BasePermission):
    """Allow view if owner or has permission"""
    def has_object_permission(self, request, view, obj):
        if obj.owner == request.user:
            return True

        # Other users can access only if a PredictorPermission exists
        return PredictorPermission.objects.filter(predictor=obj, user=request.user).exists()

# ----------------------------
# Predictor ViewSet
# ----------------------------
class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model with proper access control."""

    serializer_class = PredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns predictors the user owns or has been granted access to.
        - Owned predictors: user is the owner
        - Shared predictors: user has PredictorPermission
        """
        user = self.request.user
        return Predictor.objects.filter(
            Q(owner=user) | Q(permissions__user=user)
        ).distinct().order_by("name")

    def get_permissions(self):
        """
        Assign permissions based on the action being performed:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or shared
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsPredictorOwner()]
        elif self.action == "retrieve":
            return [permissions.IsAuthenticated(), CanAccessPredictor()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        """
        When creating a new predictor, automatically assign the owner
        to the currently authenticated user.
        """
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=["post"], url_path="retrain")
    @transaction.atomic
    def retrain(self, request, pk=None):
        """
        Re-train the predictor.
        - If settings/features are unchanged → replace existing predictor.
        - If modified → create a new predictor referencing the original as base.
        """
        predictor = self.get_object()
        
        # Only the owner should be able to re-train
        if not IsPredictorOwner():
            return Response({"detail": "You are not allowed to retrain this predictor."}, status=status.HTTP_403_FORBIDDEN)
        
        # Get new configuration (or fallback to current settings)
        new_settings = request.data.get("settings", predictor.settings)
        new_features = request.data.get("features", predictor.features)

        # Compare configurations
        config_changed = (
            new_settings != predictor.settings or
            new_features != predictor.features
        )

        # Kick off Celery task for async model retraining
        task = retrain_predictor_task.delay(
            predictor.id,
            new_settings,
            new_features,
            replace=not config_changed
        )

        return Response({
            "status": "queued",
            "task_id": task.id,
            "action": "replace" if not config_changed else "create"
        }, status=status.HTTP_202_ACCEPTED)

# ----------------------------
# PredictorPermission ViewSet
# ----------------------------
class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model with proper access control."""

    serializer_class = PredictorPermissionSerializer

    def get_queryset(self):
        """
        Only show permissions for predictors the current user owns.
        This ensures a user cannot see or modify permissions for predictors they don't own.
        """
        return PredictorPermission.objects.filter(predictor__owner=self.request.user)

    def perform_create(self, serializer):
        """
        Ensure only the predictor owner can grant access to other users.
        Raises PermissionDenied if the request user is not the owner.
        """
        predictor = serializer.validated_data["predictor"]
        if predictor.owner != self.request.user:
            raise PermissionDenied("Only the predictor owner can grant access.")
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
class PinnedPredictorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API viewset for PinnedPredictor.
    - Only returns predictors pinned by the current user.
    - Read-only: users cannot create/delete pins through this viewset.
    """
    serializer_class = PredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns predictors that are pinned by the currently authenticated user.
        """
        user = self.request.user
        return Predictor.objects.filter(pinned_by__user=user).order_by("-pinned_by__pinned_at")


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