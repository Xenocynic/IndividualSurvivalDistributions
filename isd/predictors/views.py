from django.db.models import Q
from predictors.tasks import retrain_predictor_task
from rest_framework.decorators import action
from django.db import transaction




from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Predictor, PredictorPermission, PinnedPredictor
from .serializers import PredictorSerializer, PredictorPermissionSerializer, PinnedPredictorSerializer

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_pinned_predictors(request):
    pinned = PinnedPredictor.objects.filter(user=request.user).select_related("predictor")
    # Only return the predictor info that your frontend expects
    data = [
        {
            "id": str(p.predictor.id),  # note: predictor id, not pinned record id
            "title": p.predictor.name,
            "owner_name": p.predictor.owner.username,
            "isPublic": not p.predictor.is_private,
            "updatedAt": p.predictor.updated_at.isoformat() if p.predictor.updated_at else "",
        }
        for p in pinned
    ]
    user = request.user
    print("User requesting pinned:", user)
    print("Pinned predictors returned:", pinned)
    return Response(data)


# ----------------------------
# Custom Permissions
# ----------------------------
class IsPredictorOwner(permissions.BasePermission):
    """Only predictor owners can update/delete"""
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class CanAccessPredictor(permissions.BasePermission):
    """Allow view if owner, has permission, or predictor is public"""
    def has_object_permission(self, request, view, obj):
        # Owner always has access
        if obj.owner == request.user:
            return True
        # Users can access public predictors
        if obj.is_private == False:
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
        Returns predictors the user owns, has been granted access to, or are public.
        - Owned predictors: user is the owner
        - Shared predictors: user has PredictorPermission
        - Public predictors: is_private=False
        """
        user = self.request.user
        return (
            Predictor.objects.filter(Q(owner=user) | Q(permissions__user=user))
            .distinct()
            .prefetch_related("permissions", "pinned_by")
            .order_by("name")
        )

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
        return Predictor.objects.filter(
            Q(owner=user) | Q(permissions__user=user) | Q(is_private=False)
        ).distinct().order_by("name")


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
        """Assign the logged-in user as the owner."""
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=["post"], url_path="retrain", url_name="retrain")
    @transaction.atomic
    def retrain(self, request, pk=None):
        """
        Re-train the predictor.
        - If settings/features are unchanged → replace existing predictor.
        - If modified → create a new predictor referencing the original as base.
        """
        predictor = self.get_object()
        
       # Only the owner should be able to re-train
        if predictor.owner != request.user:
            return Response(
                {"detail": "You are not allowed to retrain this predictor."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get new configuration (or fallback to current settings)
        new_settings = request.data.get("settings", {})
        new_features = request.data.get("features", [])

        # Determine if the configuration is "unchanged"
        # Since we don't have stored settings/features on the model, we only
        # check if the user is sending empty values → treat as "replace"
        config_changed = bool(new_settings or new_features)


        # Kick off Celery task for async model retraining
        task = retrain_predictor_task.delay(
            predictor.predictor_id,
            new_settings,
            new_features,
            replace=not config_changed # Replace if no changes
        )

        return Response({
            "status": "queued",
            "task_id": task.id,
            "action": "replace" if not config_changed else "create"
        }, status=status.HTTP_202_ACCEPTED)

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
        Ensure only the predictor owner can grant access to other users.
        Raises PermissionDenied if the request user is not the owner.
        """
        predictor = serializer.validated_data["predictor"]
        if predictor.owner != self.request.user:
            raise PermissionDenied("Only the predictor owner can grant access.")
        # Save without modifying the user field - it should come from the request data
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