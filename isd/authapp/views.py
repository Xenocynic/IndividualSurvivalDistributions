from rest_framework import generics, status, permissions, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.core.mail import send_mail
from django.urls import reverse
from .serializers import RegisterSerializer

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

# Forgot Password View
class ForgotPasswordView(APIView):
    """
    Sends a password reset link to the user's email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"message": "User does not exist"},
                            status=status.HTTP_200_OK)

        # create uid and token
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        try:
            reset_path = reverse('reset_password_frontend', kwargs={'uidb64': uidb64, 'token': token})
        except Exception:
            # If reverse fails for any reason, fall back to constructing path directly
            reset_path = f"/api/auth/password/reset/{uidb64}/{token}/"

        reset_url = request.build_absolute_uri(reset_path)

        # send email 
        subject = "Password Reset Request"
        message = f"Click the link to reset your password: {reset_url}"
        from_email = None  
        try:
            send_mail(subject, message, from_email, [user.email], fail_silently=False)
        except Exception as e:
            return Response({"error": "Failed to send email. Check server email settings."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Success response 
        return Response({"message": "Reset link has been sent."},
                        status=status.HTTP_200_OK)


# Reset Password View
class ResetPasswordView(APIView):
    """
    Resets the user's password using the uid and token from email.
    """
    permission_classes = [AllowAny]

    def post(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Invalid link'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate token
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        # Get and set new password
        new_password = request.data.get('password')
        if not new_password:
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password reset successful'}, status=status.HTTP_200_OK)