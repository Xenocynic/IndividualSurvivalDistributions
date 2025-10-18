"""
Predictor CRUD operations unit tests.
Tests for predictor creation, reading, updating, and deletion with proper permissions.
"""

from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken
from dataset.models import Dataset
from predictors.models import Predictor, PredictorPermission


class PredictorCRUDTests(APITestCase):
    """Test suite for predictor CRUD operations."""
    
    def setUp(self):
        """Set up test users, dataset, and auth tokens."""
        self.owner = User.objects.create_user(username="owner", password="password123")
        self.other_user = User.objects.create_user(username="other", password="password123")
        self.dataset = Dataset.objects.create(dataset_name="Dataset A", owner=self.owner)

        # URLs
        self.url = "/api/predictors/"

        # Tokens
        self.owner_token = str(AccessToken.for_user(self.owner))
        self.other_token = str(AccessToken.for_user(self.other_user))

    def test_create_predictor(self):
        """Owner can create a predictor."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        data = {"name": "Predictor 1", "description": "Desc", "dataset": self.dataset.dataset_id}
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        predictor = Predictor.objects.get(name="Predictor 1")
        self.assertEqual(predictor.owner, self.owner)

    def test_edit_predictor(self):
        """Owner can update their predictor."""
        predictor = Predictor.objects.create(name="Initial", description="Desc", dataset=self.dataset, owner=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        response = self.client.patch(
            f"{self.url}{predictor.predictor_id}/", {"description": "Updated"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        predictor.refresh_from_db()
        self.assertEqual(predictor.description, "Updated")

    def test_delete_predictor(self):
        """Owner can delete their predictor."""
        predictor = Predictor.objects.create(name="To Delete", description="Desc", dataset=self.dataset, owner=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        response = self.client.delete(f"{self.url}{predictor.predictor_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class PredictorPermissionTests(APITestCase):
    """Test suite for predictor permission system."""
    
    def setUp(self):
        """Set up test users, dataset, and auth tokens."""
        self.owner = User.objects.create_user(username="owner", password="password123")
        self.other_user = User.objects.create_user(username="other", password="password123")
        self.dataset = Dataset.objects.create(dataset_name="Dataset A", owner=self.owner)

        # URLs
        self.url = "/api/predictors/"

        # Tokens
        self.owner_token = str(AccessToken.for_user(self.owner))
        self.other_token = str(AccessToken.for_user(self.other_user))

    def test_non_owner_cannot_update(self):
        """Non-owner cannot update a predictor."""
        predictor = Predictor.objects.create(name="Initial", description="Desc", dataset=self.dataset, owner=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.client.patch(
            f"{self.url}{predictor.predictor_id}/", {"description": "Hacked"}
        )
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_non_owner_cannot_delete(self):
        """Non-owner cannot delete a predictor."""
        predictor = Predictor.objects.create(name="Initial", description="Desc", dataset=self.dataset, owner=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.client.delete(f"{self.url}{predictor.predictor_id}/")
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_non_owner_can_view_if_granted(self):
        """Non-owner can view a predictor if granted permission."""
        predictor = Predictor.objects.create(name="Shared Predictor", description="Desc", dataset=self.dataset, owner=self.owner)
        PredictorPermission.objects.create(predictor=predictor, user=self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.client.get(f"{self.url}{predictor.predictor_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_owner_cannot_view_if_restricted(self):
        """Non-owner cannot retrieve a predictor if access is restricted."""
        predictor = Predictor.objects.create(name="Private", description="Desc", dataset=self.dataset, owner=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.client.get(f"{self.url}{predictor.predictor_id}/")
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])