from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet, PinnedPredictorViewSet

router = DefaultRouter()
router.register(r"permissions", PredictorPermissionViewSet, basename="predictor-permission")
router.register(r"pins", PinnedPredictorViewSet, basename="pinned-predictor")
router.register(r"", PredictorViewSet, basename="predictor")

urlpatterns = router.urls