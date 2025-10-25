from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Dataset, DatasetPermission, PinnedDataset
from .file_utils import FileValidator
from rest_framework.exceptions import PermissionDenied
from .models import PinnedDataset

# ----------------------------
# User Serializer (lightweight)
# ----------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]

# ----------------------------
# Dataset Serializer
# ----------------------------
class DatasetSerializer(serializers.ModelSerializer):
    """
    Serializer for Dataset model.
    
    Handles serialization and validation of dataset data including file uploads.
    """
    
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    file = serializers.FileField(write_only=True, required=True, help_text='CSV or TSV file to upload')
    file_size_display = serializers.CharField(source='get_file_size_display', read_only=True)
    file_display_name = serializers.CharField(source='get_file_display_name', read_only=True)
    has_file = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Dataset
        fields = [
            "dataset_id", "dataset_name", "owner", "owner_name",
            "file", "file_path", "original_filename", "file_size", 
            "file_size_display", "file_display_name", "has_file",
            "notes", "time_unit", "is_public", "uploaded_at"
        ]
        extra_kwargs = {
            'dataset_id': {'read_only': True},
            'dataset_name': {
                'help_text': 'A descriptive name for the dataset',
                'max_length': 200,
                'required': True
            },
            'owner': {
                'help_text': 'The user who owns this dataset',
                'read_only': True
            },
            'file_path': {
                'read_only': True,
                'help_text': 'Relative path to the uploaded file'
            },
            'original_filename': {
                'read_only': True,
                'help_text': 'Original filename as uploaded by user'
            },
            'file_size': {
                'read_only': True,
                'help_text': 'File size in bytes'
            },
            'notes': {
                'help_text': 'Optional notes about the dataset',
                'required': False,
                'allow_blank': True
            },
            'time_unit': {
                'help_text': 'Time unit for survival analysis',
                'required': True
            },
            'is_public': {
                'help_text': 'Whether the dataset is publicly visible',
                'required': False,
                'default': False
            },
            'uploaded_at': {
                'read_only': True,
                'help_text': 'Timestamp when dataset was created'
            }
        }
    
    def validate_file(self, value):
        """
        Validate the uploaded file using FileValidator.
        
        Args:
            value: The uploaded file
            
        Returns:
            The validated file
            
        Raises:
            serializers.ValidationError: If file validation fails
        """
        validator = FileValidator()
        try:
            validator.validate_file(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        
        return value
    
    def validate_time_unit(self, value):
        """
        Validate time_unit field.
        
        Args:
            value: The time unit value
            
        Returns:
            The validated time unit
            
        Raises:
            serializers.ValidationError: If time unit is invalid
        """
        valid_choices = [choice[0] for choice in Dataset.TIME_UNIT_CHOICES]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Invalid time unit. Must be one of: {', '.join(valid_choices)}"
            )
        return value
    
    def validate_dataset_name(self, value):
        """
        Validate dataset_name field.
        
        Args:
            value: The dataset name
            
        Returns:
            The validated dataset name
            
        Raises:
            serializers.ValidationError: If dataset name is invalid
        """
        if not value or not value.strip():
            raise serializers.ValidationError("Dataset name cannot be empty")
        
        # Check for reasonable length
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Dataset name must be at least 3 characters long")
        
        return value.strip()
    
    def validate(self, attrs):
        """
        Perform object-level validation.
        
        Args:
            attrs: Dictionary of field values
            
        Returns:
            Validated attributes
            
        Raises:
            serializers.ValidationError: If validation fails
        """
        # Ensure file is provided for creation
        if not self.instance and 'file' not in attrs:
            raise serializers.ValidationError({
                'file': 'File is required when creating a dataset'
            })
        
        # Validate that dataset name is unique for the user
        dataset_name = attrs.get('dataset_name')
        if dataset_name and self.context.get('request'):
            user = self.context['request'].user
            existing_query = Dataset.objects.filter(
                dataset_name=dataset_name,
                owner=user
            )
            
            # Exclude current instance if updating
            if self.instance:
                existing_query = existing_query.exclude(pk=self.instance.pk)
            
            if existing_query.exists():
                raise serializers.ValidationError({
                    'dataset_name': 'You already have a dataset with this name'
                })
        
        return attrs
    
    def create(self, validated_data):
        """
        Create a new dataset with file upload processing.
        
        Args:
            validated_data: Validated data from the serializer
            
        Returns:
            Dataset: The created dataset instance
            
        Raises:
            serializers.ValidationError: If file processing fails
        """
        from .file_utils import FileStorageManager
        from django.db import transaction
        
        # Extract file from validated data
        uploaded_file = validated_data.pop('file')
        
        # Get the current user from context
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("User context is required")
        
        validated_data['owner'] = request.user
        
        # Use transaction to ensure atomicity
        try:
            with transaction.atomic():
                # Initialize file storage manager
                storage_manager = FileStorageManager()
                
                # Save the uploaded file
                file_path, sanitized_filename = storage_manager.save_uploaded_file(
                    uploaded_file, 
                    uploaded_file.name
                )
                
                # Add file metadata to validated data
                validated_data['file_path'] = file_path
                validated_data['original_filename'] = sanitized_filename
                validated_data['file_size'] = uploaded_file.size
                
                # Create the dataset instance
                dataset = Dataset.objects.create(**validated_data)
                
                return dataset
                
        except Exception as e:
            # If dataset creation fails, try to clean up the uploaded file
            if 'file_path' in locals():
                try:
                    storage_manager.delete_file(file_path)
                except:
                    pass  # Don't fail if cleanup fails
            
            # Re-raise the original exception
            if hasattr(e, 'message_dict'):
                # Django ValidationError with field-specific errors
                raise serializers.ValidationError(e.message_dict)
            else:
                # Generic error
                raise serializers.ValidationError(f"Failed to create dataset: {str(e)}")
    
    def update(self, instance, validated_data):
        """
        Update an existing dataset.
        
        Note: File updates are not supported - users must create a new dataset.
        
        Args:
            instance: The existing dataset instance
            validated_data: Validated data from the serializer
            
        Returns:
            Dataset: The updated dataset instance
        """
        # Remove file from validated_data if present (file updates not supported)
        validated_data.pop('file', None)
        
        # Update allowed fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


# ----------------------------
# Dataset Permission Serializer
# ----------------------------
class DatasetPermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for DatasetPermission model.
    Manages user permissions for dataset access.
    """
    
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    dataset = serializers.PrimaryKeyRelatedField(queryset=Dataset.objects.all())

    class Meta:
        model = DatasetPermission
        fields = ["id", "dataset", "user", "user_id"]
        read_only_fields = ["id", "pinned_at", "user"]

    def create(self, validated_data):
        """Ensure only dataset owners can grant permission."""
        request = self.context.get("request")
        dataset = validated_data["dataset"]
        if dataset.owner != request.user:
            raise PermissionDenied("You can only grant access to datasets you own.")
        return super().create(validated_data)


# ----------------------------
# Pinnned Dataset Serializer
# ----------------------------
class PinnedDatasetSerializer(serializers.ModelSerializer):
    dataset_detail = DatasetSerializer(source="dataset", read_only=True)
    dataset = serializers.PrimaryKeyRelatedField(
        queryset=Dataset.objects.all(), write_only=True
    )
    name = serializers.CharField(source="dataset.dataset_name", read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = PinnedDataset
        fields = ["id", "dataset", "dataset_id", "name", "user", "pinned_at", "dataset_detail"]
        read_only_fields = ["id", "pinned_at", "user"]

    def create(self, validated_data):
        """Prevent duplicate pins for same user."""
        request = self.context.get("request")
        user = request.user
        dataset = validated_data["dataset"]

        existing_pin = PinnedDataset.objects.filter(user=user, dataset=dataset).first()
        if existing_pin:
            raise serializers.ValidationError("This dataset is already pinned.")

        validated_data["user"] = user
        return super().create(validated_data)