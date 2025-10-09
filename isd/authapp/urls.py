from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, LogoutView

router = DefaultRouter()

urlpatterns = [
    # Register a new user
    path('register/', RegisterView.as_view(), name='register'),

    # Obtain JWT access and refresh tokens (login)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),

    # Refresh expired JWT access token using the refresh token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Blacklist refresh token (logout)
    path('logout/', LogoutView.as_view(), name='logout'),
]
