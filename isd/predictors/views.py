from django.db import models
from rest_framework import viewsets, permissions
from .models import Predictor, PredictorPermission, PinnedPredictor
from .serializers import PredictorSerializer, PredictorPermissionSerializer, PinnedPredictorSerializer


class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model."""

    serializer_class = PredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Show all public & user-owned predictors
        return Predictor.objects.filter(models.Q(is_private=False) | models.Q(owner=user)).order_by("name")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PinnedPredictorViewSet(viewsets.ModelViewSet):
    """API for users to pin/unpin predictors."""

    serializer_class = PinnedPredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PinnedPredictor.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model."""

    serializer_class = PredictorPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # User can only see/manage permissions related to predictors they own
        return PredictorPermission.objects.filter(predictor__owner=user)