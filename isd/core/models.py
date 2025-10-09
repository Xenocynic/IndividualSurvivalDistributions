from django.db import models


class User(models.Model):
    """User model for the ISD system."""
    
    user_id = models.AutoField(primary_key=True)
    user_name = models.CharField(max_length=150, unique=True)
    email_address = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    role = models.CharField(max_length=50)
    
    def __str__(self):
        return self.user_name


class Dataset(models.Model):
    """Dataset model for storing dataset information."""
    
    dataset_id = models.AutoField(primary_key=True)
    dataset_name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_datasets')
    
    def __str__(self):
        return self.dataset_name


class Predictor(models.Model):
    """Predictor model for machine learning predictors."""
    
    predictor_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='predictors')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_predictors')
    
    def __str__(self):
        return self.name


class DatasetPermission(models.Model):
    """Permission model for dataset access control."""
    
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dataset_permissions')
    
    class Meta:
        unique_together = ('dataset', 'user')
    
    def __str__(self):
        return f"{self.user.user_name} - {self.dataset.dataset_name}"


class PredictorPermission(models.Model):
    """Permission model for predictor access control."""
    
    predictor = models.ForeignKey(Predictor, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='predictor_permissions')
    
    class Meta:
        unique_together = ('predictor', 'user')
    
    def __str__(self):
        return f"{self.user.user_name} - {self.predictor.name}"
