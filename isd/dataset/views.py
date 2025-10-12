from rest_framework import viewsets, permissions
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Dataset, DatasetPermission
from rest_framework.exceptions import PermissionDenied
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
        - Owned datasets: user is the owner
        - Shared datasets: user has a DatasetPermission
        """
        user = self.request.user
        owned = Dataset.objects.filter(owner=user)
        shared = Dataset.objects.filter(datasetpermission__user=user).distinct()
        return (owned | shared).order_by("dataset_name")

    def get_permissions(self):
        """
        Assign permissions based on the action:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or user with permission
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsDatasetOwner()]
        elif self.action == "retrieve":
            return [permissions.IsAuthenticated(), CanAccessDataset()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        """
        When creating a dataset, automatically assign the authenticated user as the owner.
        """
        serializer.save(owner=self.request.user)


@extend_schema_view(
    list=extend_schema(
        summary="List dataset permissions",
        description="List all users who have access to datasets.",
        tags=["Dataset Permissions"]
    ),
    create=extend_schema(
        summary="Grant dataset access",
        description="Grant a user access to a specific dataset.",
        tags=["Dataset Permissions"]
    ),
    destroy=extend_schema(
        summary="Revoke dataset access",
        description="Revoke a user's access to a dataset.",
        tags=["Dataset Permissions"]
    )
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
        This ensures a user cannot see or modify permissions for datasets they don't own.
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
