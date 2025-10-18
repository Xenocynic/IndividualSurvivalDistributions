from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet, PinnedPredictorViewSet, list_public_predictors

router = DefaultRouter()
router.register(r"permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register(r"pins", PinnedPredictorViewSet, basename="pinned-predictor")
router.register(r"", PredictorViewSet, basename="predictor")

urlpatterns = [
    path("public/", list_public_predictors, name="public-predictors"),
] + router.urls