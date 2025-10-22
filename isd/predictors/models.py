from django.db import models
from django.contrib.auth.models import User
from dataset.models import Dataset
from django.conf import settings


class Predictor(models.Model):
    """Predictor model for machine learning predictors."""
    
    predictor_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='predictors')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_predictors')
    is_private = models.BooleanField(default=False)  # False = public, True = private
    # Links retrained models to their original
    base_predictor = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="derived_predictors"
    )
    # Training accuracy, loss, etc is stored here
    metrics = models.JSONField(blank=True, null=True)
    # Stores reference to trained model (file, URI, etc.)
    model_artifact = models.FileField(upload_to="models/", blank=True, null=True)

    def __str__(self):
        return self.name


class PinnedPredictor(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pinned_predictors")
    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name="pinned_by")
    pinned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "predictor")  # prevent duplicate pins

    def __str__(self):
        return f"{self.user.username} pinned {self.predictor.name}"


class PredictorPermission(models.Model):
    """Permission model for predictor access control."""
    
    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='predictor_permissions')
    
    class Meta:
        unique_together = ('predictor', 'user')
    
    def __str__(self):
        return f"{self.user.username} - {self.predictor.name}"
