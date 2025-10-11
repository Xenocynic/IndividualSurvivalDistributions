from django.test import TestCase
from django.contrib.auth.models import User
from dataset.models import Dataset
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import Predictor
from django.urls import reverse
from rest_framework_simplejwt.tokens import AccessToken


class PredictorTests(APITestCase):
    def setUp(self):
        # Create a user for authentication
        self.user = User.objects.create_user(username='testuser', email="testuseremail@example.com", password='password123')

        # Create a corresponding dataset
        self.dataset = Dataset.objects.create(dataset_name="Test Dataset", owner=self.user )  # create related object


        # Authenticate via JWT
        token = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.url = "/api/predictor/"  # adjust to your router path

    def test_create_predictor(self):
        """Test creating a Predictor instance via the API."""
        data = {
            "name": "My Predictor",
            "description": "Test predictor",
            "dataset": self.dataset.dataset_id,
            # include other required fields here
        }
        response = self.client.post(self.url, data, format='json')
        print(response.data)   # <-- shows which fields are missing or invalid

        # Check that the response status is 201 CREATED
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check that the Predictor exists in the database
        predictor = Predictor.objects.get(name="My Predictor")
        self.assertEqual(predictor.owner, self.user)
        self.assertEqual(predictor.description, "Test predictor")
