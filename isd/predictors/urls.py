from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet, PinnedPredictorViewSet, list_public_predictors

router = DefaultRouter()
router.register("predictors", PredictorViewSet, basename="predictors")
router.register("permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register("pins", PinnedPredictorViewSet, basename="pinned-predictor")

urlpatterns = [
    path("public/", list_public_predictors, name="public-predictors"),
] + router.urls
