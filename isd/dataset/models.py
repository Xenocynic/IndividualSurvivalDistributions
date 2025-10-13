from django.db import models
from django.contrib.auth.models import User

class Dataset(models.Model):
    """Dataset model for storing dataset information."""
    
    dataset_id = models.AutoField(primary_key=True)
    dataset_name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_datasets')
    
    def __str__(self):
        return self.dataset_name


class DatasetPermission(models.Model):
    """Permission model for dataset access control."""
    
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dataset_permissions')
    
    class Meta:
        unique_together = ('dataset', 'user')
    
    def __str__(self):
        return f"{self.user.username} - {self.dataset.dataset_name}"
