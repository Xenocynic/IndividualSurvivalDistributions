from rest_framework import serializers
from .models import Predictor, PredictorPermission


class PredictorSerializer(serializers.ModelSerializer):
    """Serializer for Predictor model."""

    class Meta:
        model = Predictor
        fields = ["predictor_id", "name", "description", "dataset", "owner"]


class PredictorPermissionSerializer(serializers.ModelSerializer):
    """Serializer for PredictorPermission model."""

    class Meta:
        model = PredictorPermission
        fields = ["id", "predictor", "user"]