from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from django.core import mail

class AuthTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('register')
        self.login_url = reverse('token_obtain_pair')
        self.logout_url = reverse('logout')
        self.refresh_url = reverse('token_refresh')
        self.forgot_password_url = reverse('user_forgot_password_api')
        self.reset_password_url_name = 'user_reset_password_api'

        self.user_data = {
            "username": "testuser",
            "email": "testuser@example.com",
            "password": "StrongPassword123!",
            "password2": "StrongPassword123!"
        }

    def test_register_user(self):
        """Ensure a new user can register successfully"""
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="testuser").exists())

    def test_login_user(self):
        """Ensure a registered user can log in and receive tokens"""
        User.objects.create_user(username="testuser", email="testuser@example.com", password="StrongPassword123!")
        response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "StrongPassword123!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_logout_user(self):
        """Ensure a user can log out and blacklist refresh token"""
        user = User.objects.create_user(username="testuser", password="StrongPassword123!")
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

        response = self.client.post(self.logout_url, {"refresh": str(refresh)}, format='json')
        self.assertIn(response.status_code, [status.HTTP_205_RESET_CONTENT, status.HTTP_200_OK])

    def test_refresh_token(self):
        """Ensure refresh token can be used to get new access token"""
        user = User.objects.create_user(username="testuser", password="StrongPassword123!")
        refresh = RefreshToken.for_user(user)

        response = self.client.post(self.refresh_url, {"refresh": str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_forgot_password_sends_email(self):
        """Ensure forgot password sends reset email"""
        User.objects.create_user(username="testuser", email="testuser@example.com", password="StrongPassword123!")
        response = self.client.post(self.forgot_password_url, {"email": "testuser@example.com"}, format='json')

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_202_ACCEPTED])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset", mail.outbox[0].body.lower())

    def test_reset_password_success(self):
        """Ensure password can be reset with valid token and new password"""
        user = User.objects.create_user(username="testuser", email="testuser@example.com", password="OldPass123!")

        # Simulate token + uid that would come in the email
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.contrib.auth.tokens import default_token_generator

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = reverse(self.reset_password_url_name, kwargs={'uidb64': uid, 'token': token})

        new_password_data = {
            "password": "NewPass123!",
            "password2": "NewPass123!"
        }

        response = self.client.post(reset_url, new_password_data, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPass123!"))
