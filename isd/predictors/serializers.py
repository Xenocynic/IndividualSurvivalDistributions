from rest_framework import serializers
from .models import Predictor, PredictorPermission, PinnedPredictor


class PredictorSerializer(serializers.ModelSerializer):
    """Serializer for Predictor model."""

    class Meta:
        model = Predictor
        fields = ["predictor_id", "name", "description", "dataset", "owner", "is_private"]
        extra_kwargs = {
            "owner": {"read_only": True}
        }


class PinnedPredictorSerializer(serializers.ModelSerializer):
    """Serializer for pinned predictors."""

    class Meta:
        model = PinnedPredictor
        fields = ["id", "user", "predictor", "pinned_at"]
        extra_kwargs = {
            "user": {"read_only": True}
        }


class PredictorPermissionSerializer(serializers.ModelSerializer):
    """Serializer for PredictorPermission model."""

    class Meta:
        model = PredictorPermission
        fields = ["id", "predictor", "user"]