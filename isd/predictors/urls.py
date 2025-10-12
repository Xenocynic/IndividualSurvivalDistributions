from rest_framework.routers import DefaultRouter
from .views import PredictorViewSet, PredictorPermissionViewSet

router = DefaultRouter()
router.register(r"", PredictorViewSet, basename="predictor")
router.register(r"permissions", PredictorPermissionViewSet, basename="predictor-permission")

urlpatterns = router.urls