from django.db.models import Q
from rest_framework import viewsets, permissions
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.exceptions import PermissionDenied
from .models import Dataset, DatasetPermission
from .serializers import DatasetSerializer, DatasetPermissionSerializer

# ----------------------------
# Custom Permissions
# ----------------------------
class IsDatasetOwner(permissions.BasePermission):
    """Only dataset owners can update/delete"""
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class CanAccessDataset(permissions.BasePermission):
    """Allow view if owner or has permission"""
    def has_object_permission(self, request, view, obj):
        if obj.owner == request.user:
            return True
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
        description="Create a new dataset. The authenticated user becomes the owner.",
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
        description="Delete a dataset. Only the owner can delete. This action cannot be undone.",
        tags=["Datasets"]
    ),
)
class DatasetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing datasets.
    Provides CRUD operations for datasets with proper ownership and permission checks.
    """
    serializer_class = DatasetSerializer

    def get_queryset(self):
        """
        Return datasets that the user owns or has permission to access.
        Uses Q objects for efficiency and correctness.
        """
        user = self.request.user
        return (
            Dataset.objects.filter(
                Q(owner=user) | Q(permissions__user=user)
            )
            .distinct()
            .order_by("dataset_name")
        )

    def get_permissions(self):
        """
        Assign permissions based on the action:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or user with permission
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            permission_classes = [permissions.IsAuthenticated, IsDatasetOwner]
        elif self.action == "retrieve":
            permission_classes = [permissions.IsAuthenticated, CanAccessDataset]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [perm() for perm in permission_classes]

    def perform_create(self, serializer):
        """Automatically assign the authenticated user as the dataset owner."""
        serializer.save(owner=self.request.user)


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
