from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Predictor, PredictorPermission, PinnedPredictor
from dataset.models import Dataset
from rest_framework.exceptions import PermissionDenied


# ----------------------------
# User Serializer (lightweight)
# ----------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]

# ----------------------------
# Dataset Serializer (minimal)
# ----------------------------
class DatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ["dataset_id", "dataset_name"]  

# ----------------------------
# Predictor Serializer
# ----------------------------
class PredictorSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    dataset = DatasetSerializer(read_only=True)
    dataset_id = serializers.PrimaryKeyRelatedField(
        queryset=Dataset.objects.all(),
        source='dataset',
        write_only=True # This means it will not appear in responses (get, etc)
    )

    features = serializers.ListField(child=serializers.CharField(), read_only=True, required=False)

    class Meta:
        model = Predictor
        fields = [
            "predictor_id",
            "name",
            "description",
            "dataset", # Read-only, appears in responses like GET
            "dataset_id", # Write-only, For POST/PATCH
            "owner",
            "is_private",
            "time_unit",
            "num_time_points",
            "regularization",
            "objective_function",
            "marginal_loss_type",
            "c_param_search_scope",
            "cox_feature_selection",
            "mrmr_feature_selection",
            "mtlr_predictor",
            "standardize_features",
            "run_cross_validation",
            "tune_parameters",
            "use_smoothed_log_likelihood",
            "use_predefined_folds",
            "created_at",
            "updated_at",
            "features",
        ]
        read_only_fields = [
            "predictor_id", "owner", "created_at", "updated_at", "features"
        ]
    
    def create(self, validated_data):
        """Automatically attach owner during creation."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["owner"] = request.user
        return super().create(validated_data)

# ----------------------------
# Predictor Permission Serializer
# ----------------------------
class PredictorPermissionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    predictor = serializers.PrimaryKeyRelatedField(queryset=Predictor.objects.all())

    class Meta:
        model = PredictorPermission
        fields = ["id", "predictor", "user", "user_id"]

    def create(self, validated_data):
        """Ensure only predictor owners can grant permission."""
        request = self.context.get("request")
        predictor = validated_data["predictor"]
        if predictor.owner != request.user:
            raise PermissionDenied("You can only grant access to predictors you own.")
        return super().create(validated_data)


# ----------------------------
# Pinned Predictor Serializer
# ----------------------------
class PinnedPredictorSerializer(serializers.ModelSerializer):
    predictor = PredictorSerializer(read_only=True)
    predictor_id = serializers.PrimaryKeyRelatedField(
        queryset=Predictor.objects.all(), source="predictor", write_only=True
    )
    name = serializers.CharField(source="predictor.name", read_only=True)

    class Meta:
        model = PinnedPredictor
        fields = ["id", "predictor", "predictor_id", "name", "pinned_at"]
        read_only_fields = ["id", "pinned_at", "user"]

    def create(self, validated_data):
        """Prevent duplicate pins for same user."""
        request = self.context.get("request")
        user = request.user
        predictor = validated_data["predictor"]

        existing_pin = PinnedPredictor.objects.filter(user=user, predictor=predictor).first()
        if existing_pin:
            raise serializers.ValidationError("This predictor is already pinned.")

        validated_data["user"] = user
        return super().create(validated_data)
