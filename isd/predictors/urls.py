from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet

router = DefaultRouter()
router.register("", PredictorViewSet, basename="predictor")
router.register("permissions", PredictorPermissionViewSet, basename="predictor-permission")

urlpatterns = router.urls