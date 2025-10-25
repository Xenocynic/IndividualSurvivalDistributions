from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet, PinnedPredictorViewSet, list_public_predictors, list_pinned_predictors 

router = DefaultRouter()
router.register("permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register("pins", PinnedPredictorViewSet, basename="pinned-predictor")
router.register("", PredictorViewSet, basename="predictors")

urlpatterns = [
    path("public/", list_public_predictors, name="public-predictors"),
    path("predictors/pins/", list_pinned_predictors, name="list-pinned-predictors"), 
] + router.urls
