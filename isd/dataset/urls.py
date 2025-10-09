from rest_framework.routers import DefaultRouter
from .views import DatasetViewSet, DatasetPermissionViewSet

router = DefaultRouter()
router.register("", DatasetViewSet, basename="dataset")
router.register("permissions", DatasetPermissionViewSet, basename="dataset-permission")

urlpatterns = router.urls