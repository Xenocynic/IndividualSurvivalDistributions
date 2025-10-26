from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet
from predictors.views import resolve_username

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path('', include(router.urls)),
    path("resolve/", resolve_username, name="resolve-username"),
]
