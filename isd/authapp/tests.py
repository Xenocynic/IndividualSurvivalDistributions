from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

class AuthTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('register')
        self.login_url = reverse('token_obtain_pair')
        self.logout_url = reverse('logout')
        self.refresh_url = reverse('token_refresh')

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
