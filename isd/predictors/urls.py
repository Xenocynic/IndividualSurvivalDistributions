"""
URL configuration for predictors app (including ML API integration)
Place this in: predictors/urls.py
"""
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    PredictorViewSet, 
    PredictorPermissionViewSet, 
    PinnedPredictorViewSet, 
    list_public_predictors,
    resolve_username,
    # ML API views
    ml_health_check,
    ml_train_model,
    ml_retrain_model,
    ml_predict,
    ml_list_models,
    # Predictor-specific ML views
    predict_with_predictor,
)

router = DefaultRouter()
router.register("permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register("pins", PinnedPredictorViewSet, basename="pinned-predictor")
router.register("", PredictorViewSet, basename="predictors")

urlpatterns = [
    # Existing predictor views
    path("public/", list_public_predictors, name="public-predictors"),
    path("resolve-username/", resolve_username, name="resolve-username"),
    
    # ===================================
    # ML API Integration Routes
    # ===================================
    path("ml/health/", ml_health_check, name="ml-health"),
    path("ml/train/", ml_train_model, name="ml-train"),
    path("ml/retrain/", ml_retrain_model, name="ml-retrain"),
    path("ml/predict/", ml_predict, name="ml-predict"),
    path("ml/models/", ml_list_models, name="ml-list-models"),
] + router.urls