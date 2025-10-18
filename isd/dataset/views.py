from django.db.models import Q
from django.db import transaction
from django.http import HttpResponse, Http404
from django.core.files.storage import default_storage
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.exceptions import PermissionDenied
from .models import Dataset, DatasetPermission
from .serializers import DatasetSerializer, DatasetPermissionSerializer
from .file_utils import FileStorageManager
from .tasks import process_feature_imputation
import os
import mimetypes

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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
                if dataset.file_path:
                    try:
                        imputation_result = process_feature_imputation(dataset.dataset_id)
                        if imputation_result['success']:
                            # Update the dataset with new file size after imputation
                            storage_manager = FileStorageManager()
                            new_size = storage_manager.get_file_size(dataset.file_path)
                            if new_size:
                                dataset.file_size = new_size
                                dataset.save()
                    except Exception as imputation_error:
                        # Log the error but don't fail the dataset creation
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Auto-imputation failed for dataset {dataset.dataset_id}: {str(imputation_error)}")
                
                # Prepare response data
                response_data = serializer.data
                
                # Add imputation results to response if available
                if imputation_result and imputation_result['success']:
                    response_data['imputation'] = {
                        'performed': True,
                        'details': imputation_result['details']
                    }
                else:
                    response_data['imputation'] = {
                        'performed': False,
                        'reason': 'No missing values found or imputation failed'
                    }
                
                # Return success response
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


# ----------------------------
# Public Dataset Views
# ----------------------------
@extend_schema(
    summary="List public datasets",
    description="Retrieve a list of all public datasets. No authentication required.",
    tags=["Public Datasets"]
)
@api_view(['GET'])
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
