from rest_framework import serializers

from .models import User, Dataset, Predictor, DatasetPermission, PredictorPermission


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    class Meta:
        model = User
        fields = ["user_id", "user_name", "email_address", "password", "role"]
        extra_kwargs = {'password': {'write_only': True}}


class DatasetSerializer(serializers.ModelSerializer):
    """Serializer for Dataset model."""

    class Meta:
        model = Dataset
        fields = ["dataset_id", "dataset_name", "owner"]


class PredictorSerializer(serializers.ModelSerializer):
    """Serializer for Predictor model."""

    class Meta:
        model = Predictor
        fields = ["predictor_id", "name", "description", "dataset", "owner"]


class DatasetPermissionSerializer(serializers.ModelSerializer):
    """Serializer for DatasetPermission model."""

    class Meta:
        model = DatasetPermission
        fields = ["id", "dataset", "user"]


class PredictorPermissionSerializer(serializers.ModelSerializer):
    """Serializer for PredictorPermission model."""

    class Meta:
        model = PredictorPermission
        fields = ["id", "predictor", "user"]
