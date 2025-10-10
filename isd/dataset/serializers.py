from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Dataset, DatasetPermission


class DatasetSerializer(serializers.ModelSerializer):
    """
    Serializer for Dataset model.
    
    Handles serialization and validation of dataset data.
    """
    
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    
    class Meta:
        model = Dataset
        fields = ["dataset_id", "dataset_name", "owner", "owner_name"]
        extra_kwargs = {
            'dataset_id': {'read_only': True},
            'dataset_name': {
                'help_text': 'A descriptive name for the dataset',
                'max_length': 200
            },
            'owner': {
                'help_text': 'The user who owns this dataset',
                'read_only': True
            }
        }


class DatasetPermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for DatasetPermission model.
    
    Manages user permissions for dataset access.
    """
    
    dataset_name = serializers.CharField(source='dataset.dataset_name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = DatasetPermission
        fields = ["id", "dataset", "dataset_name", "user", "user_name"]
        extra_kwargs = {
            'dataset': {'help_text': 'The dataset to grant access to'},
            'user': {'help_text': 'The user to grant access to'}
        }