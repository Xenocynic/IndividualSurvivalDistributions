from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q

from .models import Predictor, PredictorPermission, PinnedPredictor
from .serializers import PredictorSerializer, PredictorPermissionSerializer

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
        return (
            Predictor.objects.filter(Q(owner=user) | Q(permissions__user=user))
            .distinct()
            .prefetch_related("permissions", "pinned_by")
            .order_by("name")
        )

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
        """
        When creating a new predictor, automatically assign the owner
        to the currently authenticated user.
        """
        serializer.save(owner=self.request.user)

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