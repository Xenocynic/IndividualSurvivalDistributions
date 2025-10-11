from rest_framework import viewsets
from .models import Predictor, PredictorPermission
from .serializers import PredictorSerializer, PredictorPermissionSerializer


class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model."""

    queryset = Predictor.objects.all().order_by("name")
    serializer_class = PredictorSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model."""

    queryset = PredictorPermission.objects.all()
    serializer_class = PredictorPermissionSerializer
