from rest_framework import generics, status, permissions, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer

# Register new users

class RegisterView(generics.CreateAPIView):
    """
    Allows new users to register.
    Uses RegisterSerializer to validate and create a user.
    Accessible to anyone (authenticated or unauthenticated)
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

# Logout View
class LogoutView(APIView):
    """
    Logs out user by blacklisting their refresh token.
    Requires authentication. The client must provide a valid refresh token in request.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]  # token sent by client
            token = RefreshToken(refresh_token)
            token.blacklist()  # invalidate token
            return Response({"message": "Logged out successfully"}, status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
class UserViewSet(viewsets.ModelViewSet):
    """API viewset for Django User model with profiles."""

    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer