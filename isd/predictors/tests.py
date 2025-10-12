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

    def test_delete_predictor(self):
        """Test deleting a Predictor instance via the API."""
        # First, create a predictor owned by the authenticated user
        predictor = Predictor.objects.create(
            name="My Predictor",
            description="Test predictor to delete",
            dataset=self.dataset,
            owner=self.user
        )

        # Construct the detail URL (assuming you use DefaultRouter)
        detail_url = f"{self.url}{predictor.predictor_id}/"

        # Send DELETE request
        response = self.client.delete(detail_url)

        # Assert that the response status is HTTP 204 NO CONTENT
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Assert that the predictor has been deleted from the database
        self.assertFalse(Predictor.objects.filter(predictor_id=predictor.predictor_id).exists())