from rest_framework import viewsets, permissions
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
        user = self.request.user
        # Show all public & user-owned predictors
        return Predictor.objects.filter(models.Q(is_private=False) | models.Q(owner=user)).order_by("name")

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
