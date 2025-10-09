from rest_framework.routers import DefaultRouter

from .views import (
    UserViewSet, DatasetViewSet, PredictorViewSet,
    DatasetPermissionViewSet, PredictorPermissionViewSet
)


router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("datasets", DatasetViewSet, basename="dataset")
router.register("predictors", PredictorViewSet, basename="predictor")
router.register("dataset-permissions", DatasetPermissionViewSet, basename="dataset-permission")
router.register("predictor-permissions", PredictorPermissionViewSet, basename="predictor-permission")

urlpatterns = router.urls
