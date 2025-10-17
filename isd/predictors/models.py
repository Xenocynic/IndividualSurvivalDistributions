from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from dataset.models import Dataset

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
        unique_together = ("user", "predictor")  # prevent duplicate pins
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["predictor"]),
        ]
        verbose_name = "Pinned Predictor"
        verbose_name_plural = "Pinned Predictors"

    def __str__(self):
        return f"{self.user.username} pinned {self.predictor.name}"

# ----------------------------
# PredictorPermission Model
# ----------------------------
class PredictorPermission(models.Model):
    """Grants access permissions to predictors for specific users."""

    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name="permissions")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictor_permissions")
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
        return f"{self.user.username} - {self.predictor.name}"
