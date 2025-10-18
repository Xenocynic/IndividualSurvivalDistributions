from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet, PinnedPredictorViewSet

router = DefaultRouter()
router.register("predictors", PredictorViewSet, basename="predictors")
router.register("permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register("pins", PinnedPredictorViewSet, basename="pinned-predictor")

urlpatterns = router.urls