from rest_framework import generics, status, permissions, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .serializers import RegisterSerializer

from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from drf_spectacular.utils import extend_schema
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse


# Custom Login View with HttpOnly Cookie
class CookieTokenObtainPairView(TokenObtainPairView):
    """
    Custom login view that stores refresh token in HttpOnly cookie
    and returns access token in response body.
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            refresh_token = response.data.get('refresh')
            access_token = response.data.get('access')
            
            # Set refresh token in HttpOnly cookie
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True, # Makes sure javascript can't access the cookie
                secure=False,  # False for development (HTTP), True for production (HTTPS)
                samesite='Lax',  # or 'Strict' depending on needs
                max_age=60 * 60 * 24 * 7,  # 7 days
                path='/'
            )
            
            # Remove refresh token from response body (optional but recommended)
            response.data = {
                'access': access_token,
                'message': 'Login successful'
            }
        
        return response


# Custom Token Refresh View with HttpOnly Cookie
class CookieTokenRefreshView(APIView):
    """
    Custom token refresh view that reads refresh token from HttpOnly cookie
    and returns new access token.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        # Get refresh token from cookie
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not refresh_token:
            return Response(
                {'error': 'Refresh token not found'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Create RefreshToken object
            token = RefreshToken(refresh_token)
            
            # Generate new access token
            access_token = str(token.access_token)
            
            # Create response
            response = Response({
                'access': access_token,
                'message': 'Token refreshed successfully'
            }, status=status.HTTP_200_OK)
            
            # If token rotation is enabled, generate new refresh token
            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                token.set_jti()
                token.set_exp()
                new_refresh_token = str(token)
                
                # Blacklist the old token if configured
                if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                    try:
                        token.blacklist()
                    except AttributeError:
                        pass
                
                # Update the refresh token cookie
                response.set_cookie(
                    key='refresh_token',
                    value=new_refresh_token,
                    httponly=True,
                    secure=False, # False for development (HTTP), True for production (HTTPS)
                    samesite='Lax',
                    max_age=60 * 60 * 24 * 7,  # 7 days
                    path='/'
                )
            
            return response
            
        except (TokenError, InvalidToken) as e:
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )

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
    Logs out user by blacklisting their refresh token and clearing the cookie.
    Requires authentication. The refresh token is read from the HttpOnly cookie.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            # Get refresh token from cookie
            refresh_token = request.COOKIES.get('refresh_token')
            
            if not refresh_token:
                return Response(
                    {"error": "Refresh token not found"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Blacklist the token
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            # Create response and clear the cookie
            response = Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_205_RESET_CONTENT
            )
            
            response.delete_cookie(
                key='refresh_token',
                path='/',
                samesite='Lax'
            )
            
            return response
            
        except Exception as e:
            response = Response(
                {"error": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST
            )
            # Still clear the cookie even if blacklisting fails
            response.delete_cookie(
                key='refresh_token',
                path='/',
                samesite='Lax'
            )
            return response
          
class UserForgotPasswordView(APIView):
    """
    Sends a password reset email with a unique token link.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        UserModel = get_user_model()
        try:
            user = UserModel.objects.get(email=email)
        except UserModel.DoesNotExist:
            return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        reset_url = f"{settings.FRONTEND_URL}/reset/confirm/{uidb64}/{token}/"

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

        UserModel = get_user_model()
        try:
            user = UserModel.objects.get(email=email)
        except UserModel.DoesNotExist:
            return Response({"error": "User does not exist"}, status=status.HTTP_200_OK)

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


class UserResetPasswordView(APIView):
    """
    Confirms password reset by validating token and setting a new password.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        uidb64 = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not uidb64 or not token or not new_password:
            return Response({'error': 'Missing fields'}, status=400)
        
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = get_user_model().objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist):
            return Response({"error": "Invalid link"}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()

        return Response({"message": "Password reset successful"}, status=status.HTTP_200_OK)

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
