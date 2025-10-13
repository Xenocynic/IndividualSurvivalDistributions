from django.db import models
from django.contrib.auth.models import User
from dataset.models import Dataset


class Predictor(models.Model):
    """Predictor model for machine learning predictors."""
    
    predictor_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='predictors')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_predictors')
    
    def __str__(self):
        return self.name


class PredictorPermission(models.Model):
    """Permission model for predictor access control."""
    
    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='predictor_permissions')
    
    class Meta:
        unique_together = ('predictor', 'user')
    
    def __str__(self):
        return f"{self.user.username} - {self.predictor.name}"
