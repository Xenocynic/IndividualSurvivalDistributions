from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from dataset.models import Dataset
from django.utils import timezone


# ----------------------------
# Predictor Model
# ----------------------------
class Predictor(models.Model):
    """Predictor model for machine learning predictors."""

    predictor_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name="predictors")
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_predictors")
    is_private = models.BooleanField(default=False)  # False = public, True = private
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Predictor"
        verbose_name_plural = "Predictors"

    # --- Advanced configuration fields ---
    time_unit = models.CharField(
        max_length=10,
        choices=[('day', 'Day'), ('week', 'Week'), ('month', 'Month'), ('year', 'Year')],
        default='day'
    )

    num_time_points = models.PositiveIntegerField(blank=True, null=True)
    regularization = models.CharField(max_length=5, choices=[('l1', 'L1'), ('l2', 'L2')], default='l2')
    objective_function = models.CharField(max_length=50, default='log-likelihood')
    marginal_loss_type = models.CharField(max_length=50, default='weighted')
    c_param_search_scope = models.CharField(max_length=20, default='basic')

    cox_feature_selection = models.BooleanField(default=False)
    mrmr_feature_selection = models.BooleanField(default=False)
    mtlr_predictor = models.CharField(max_length=50, default='stable')

    # --- Recommended settings ---
    standardize_features = models.BooleanField(default=True)
    run_cross_validation = models.BooleanField(default=True)
    tune_parameters = models.BooleanField(default=True)
    use_smoothed_log_likelihood = models.BooleanField(default=False)
    use_predefined_folds = models.BooleanField(default=False)

    # --- System metadata ---
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)



    def __str__(self):
        return self.name

# ----------------------------
# PinnedPredictor Model
# ----------------------------
class PinnedPredictor(models.Model):
    """Tracks which predictors a user has pinned for quick access."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,related_name="pinned_predictors")
    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name="pinned_by")
    pinned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "predictors_pinnedpredictor"
        unique_together = ("user", "predictor")  # prevent duplicate pins
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["predictor"]),
        ]
        verbose_name = "Pinned Predictor"
        verbose_name_plural = "Pinned Predictors"
        ordering = ['-pinned_at'] # order by most recent

    def __str__(self):
        return f"{self.user.username} pinned {self.predictor.name}"

# ----------------------------
# PredictorPermission Model
# ----------------------------
class PredictorPermission(models.Model):
    """Grants access permissions to predictors for specific users."""
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("viewer", "Viewer"),
    ]

    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name="permissions")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictor_permissions")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="viewer")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("predictor", "user")
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["predictor"]),
        ]
        verbose_name = "Predictor Permission"
        verbose_name_plural = "Predictor Permissions"

    def __str__(self):
        return f"{self.user.username} - {self.predictor.name} ({self.role})"
