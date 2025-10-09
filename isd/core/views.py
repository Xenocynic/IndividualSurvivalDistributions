from rest_framework import viewsets

from .models import User, Dataset, Predictor, DatasetPermission, PredictorPermission
from .serializers import (
    UserSerializer, DatasetSerializer, PredictorSerializer,
    DatasetPermissionSerializer, PredictorPermissionSerializer
)


class UserViewSet(viewsets.ModelViewSet):
    """API viewset for User model."""

    queryset = User.objects.all().order_by("user_name")
    serializer_class = UserSerializer


class DatasetViewSet(viewsets.ModelViewSet):
    """API viewset for Dataset model."""

    queryset = Dataset.objects.all().order_by("dataset_name")
    serializer_class = DatasetSerializer


class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model."""

    queryset = Predictor.objects.all().order_by("name")
    serializer_class = PredictorSerializer


class DatasetPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for DatasetPermission model."""

    queryset = DatasetPermission.objects.all()
    serializer_class = DatasetPermissionSerializer


class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model."""

    queryset = PredictorPermission.objects.all()
    serializer_class = PredictorPermissionSerializer
