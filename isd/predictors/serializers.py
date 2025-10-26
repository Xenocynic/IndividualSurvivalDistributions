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
# Folder Serializer (lightweight)
# ----------------------------
class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        from folders.models import Folder
        model = Folder
        fields = ["folder_id", "name"]


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
    folder_id = serializers.IntegerField(write_only=True, required=False, allow_null=True, help_text="ID of folder to add predictor to")
    folder = FolderSerializer(read_only=True, help_text="Folder containing this predictor")
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
            "folder", # Read-only, folder information
            "folder_id", # Write-only, for folder assignment
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
            "allow_admin_access",
            "created_at",
            "updated_at",
            "features",
        ]
        read_only_fields = [
            "predictor_id", "owner", "created_at", "updated_at", "features"
        ]
    
    def validate_folder_id(self, value):
        """Validate folder_id field."""
        if value is None:
            return value
            
        request = self.context.get("request")
        if not request or not request.user:
            raise serializers.ValidationError("User context is required")
        
        # Import here to avoid circular imports
        from folders.models import Folder
        
        try:
            folder = Folder.objects.get(folder_id=value)
        except Folder.DoesNotExist:
            raise serializers.ValidationError("Folder does not exist")
        
        # Check if user owns the folder
        if folder.owner != request.user:
            raise serializers.ValidationError("You can only add predictors to folders you own")
        
        return value
    
    def to_representation(self, instance):
        """Add folder information to the response."""
        data = super().to_representation(instance)
        
        # Get folder information if predictor is in a folder
        from folders.models import FolderItem
        from django.contrib.contenttypes.models import ContentType
        
        predictor_ct = ContentType.objects.get_for_model(Predictor)
        folder_item = FolderItem.objects.filter(
            content_type=predictor_ct,
            object_id=instance.predictor_id
        ).select_related('folder').first()
        
        if folder_item:
            data['folder'] = {
                'folder_id': folder_item.folder.folder_id,
                'name': folder_item.folder.name
            }
        else:
            data['folder'] = None
            
        return data
    
    def validate_folder_id(self, value):
        """Validate folder_id field."""
        if value is None:
            return value
            
        request = self.context.get("request")
        if not request or not request.user:
            raise serializers.ValidationError("User context is required")
        
        # Import here to avoid circular imports
        from folders.models import Folder
        
        try:
            folder = Folder.objects.get(folder_id=value)
        except Folder.DoesNotExist:
            raise serializers.ValidationError("Folder does not exist")
        
        # Check if user owns the folder
        if folder.owner != request.user:
            raise serializers.ValidationError("You can only add predictors to folders you own")
        
        return value
    
    def to_representation(self, instance):
        """Add folder information to the response."""
        data = super().to_representation(instance)
        
        # Get folder information if predictor is in a folder
        from folders.models import FolderItem
        from django.contrib.contenttypes.models import ContentType
        
        predictor_ct = ContentType.objects.get_for_model(Predictor)
        folder_item = FolderItem.objects.filter(
            content_type=predictor_ct,
            object_id=instance.predictor_id
        ).select_related('folder').first()
        
        if folder_item:
            data['folder'] = {
                'folder_id': folder_item.folder.folder_id,
                'name': folder_item.folder.name
            }
        else:
            data['folder'] = None
            
        return data
    
    def create(self, validated_data):
        """Automatically attach owner and handle folder assignment during creation."""
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["owner"] = request.user
        return super().create(validated_data)


# ----------------------------
# Predictor Permission Serializer
# ----------------------------
class PredictorPermissionSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True)
    user_display = UserSerializer(source="user", read_only=True)
    predictor = serializers.PrimaryKeyRelatedField(queryset=Predictor.objects.all())
    role = serializers.ChoiceField(choices=PredictorPermission.ROLE_CHOICES, default="viewer")

    class Meta:
        model = PredictorPermission
        fields = ["id", "predictor", "user", "user_id", "user_display", "role"]

    def validate_predictor(self, value):
        """Validate that the user owns the predictor."""
        request = self.context.get("request")
        if not request or not request.user:
            raise PermissionDenied("Authentication required.")
        
        if value.owner != request.user:
            raise PermissionDenied("You can only grant access to predictors you own.")
        
        return value

    def create(self, validated_data):
        """Create predictor permission after validation."""
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
