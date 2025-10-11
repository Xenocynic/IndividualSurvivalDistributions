from django.test import TestCase

from django.contrib.auth.models import User
from dataset.models import Dataset
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import Predictor
from django.urls import reverse
from rest_framework_simplejwt.tokens import AccessToken

# Create your tests here.

class PredictorTests(APITestCase):
    def setUp(self):
        # Create a user for authentication
        self.user = User.objects.create_user(username='testuser', email="testuseremail@example.com", password='password123')

        # Create a corresponding dataset
        self.dataset = Dataset.objects.create(dataset_name="Test Dataset", owner=self.user )  # create related object


        # Authenticate via JWT
        token = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.url = "/api/predictors/"  # adjust to your router path

    def test_edit_predictor(self):
        """Test editing a Predictor instance via the API."""

        # Step 1: Create a predictor
        predictor = Predictor.objects.create(
            name="Initial Predictor",
            description="Initial description",
            dataset=self.dataset,
            owner=self.user
        )

        # Step 2: Prepare update data
        updated_data = {
            "name": "Updated Predictor",
            "description": "Updated description",
            "dataset": self.dataset.dataset_id
        }

        # Step 3: Send PATCH request to update the predictor
        response = self.client.patch(f"{self.url}{predictor.predictor_id}/", updated_data, format='json')

        # Step 4: Assert successful update
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 5: Verify that the database reflects the update
        predictor.refresh_from_db()
        self.assertEqual(predictor.name, "Updated Predictor")
        self.assertEqual(predictor.description, "Updated description")

        