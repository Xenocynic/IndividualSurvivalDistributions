from rest_framework import viewsets
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Dataset, DatasetPermission
from .serializers import DatasetSerializer, DatasetPermissionSerializer


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

    queryset = Dataset.objects.all().order_by("dataset_name")
    serializer_class = DatasetSerializer


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
)
class DatasetPermissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing dataset permissions.
    
    Allows dataset owners to grant or revoke access to their datasets.
    """

    queryset = DatasetPermission.objects.all()
    serializer_class = DatasetPermissionSerializer
