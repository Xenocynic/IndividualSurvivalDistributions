from rest_framework import viewsets
from .models import Predictor, PredictorPermission
from .serializers import PredictorSerializer, PredictorPermissionSerializer


class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model."""

    queryset = Predictor.objects.all().order_by("name")
    serializer_class = PredictorSerializer


class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model."""

    queryset = PredictorPermission.objects.all()
    serializer_class = PredictorPermissionSerializer
