from django.urls import reverse
from django.contrib.auth.models import User
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from rest_framework.test import APITestCase
from rest_framework import status

class PasswordResetFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="oldpassword")
        self.forgot_url = reverse('forgot_password_api')

    def test_password_reset_email_sent(self):
        """POST valid email 200 OK"""
        response = self.client.post(self.forgot_url, {"email": "test@example.com"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_invalid_email(self):
        """POST invalid email still 200 OK"""
        response = self.client.post(self.forgot_url, {"email": "noone@example.com"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm(self):
        """POST valid uid + password 200 OK"""
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        reset_url = reverse('reset_password', kwargs={'uidb64': uidb64, 'token': token})

        response = self.client.post(reset_url, {"password": "newsecurepassword"}, format='json')

        # API should return 200 if success
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newsecurepassword"))