from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Dataset, DatasetPermission
from rest_framework_simplejwt.tokens import AccessToken

class DatasetTests(APITestCase):
    def setUp(self):
        # Create users
        self.owner = User.objects.create_user(username='owner', email="owner@example.com", password='password123')
        self.other_user = User.objects.create_user(username='other', email="other@example.com", password='password123')

        # Authenticate as owner using JWT
        token = AccessToken.for_user(self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        self.url = "/api/datasets/"

    # -----------------------
    # Owner tests
    # -----------------------
    def test_create_dataset(self):
        """Owner can create a dataset."""
        data = {"dataset_name": "My Dataset"}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        dataset = Dataset.objects.get(dataset_name="My Dataset")
        self.assertEqual(dataset.owner, self.owner)

    def test_update_dataset(self):
        """Owner can update their dataset."""
        dataset = Dataset.objects.create(dataset_name="Initial Dataset", owner=self.owner)
        data = {"dataset_name": "Updated Dataset"}
        response = self.client.patch(f"{self.url}{dataset.dataset_id}/", data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dataset.refresh_from_db()
        self.assertEqual(dataset.dataset_name, "Updated Dataset")

    def test_delete_dataset(self):
        """Owner can delete their dataset."""
        dataset = Dataset.objects.create(dataset_name="To Delete", owner=self.owner)
        response = self.client.delete(f"{self.url}{dataset.dataset_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Dataset.objects.filter(dataset_id=dataset.dataset_id).exists())

    # -----------------------
    # Non-owner tests
    # -----------------------
    def test_non_owner_cannot_update(self):
        """Non-owner cannot update dataset."""
        dataset = Dataset.objects.create(dataset_name="Owner Dataset", owner=self.owner)
        token = AccessToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        updated_data = {"dataset_name": "Updated by Non-Owner"}
        response = self.client.patch(f"{self.url}{dataset.dataset_id}/", updated_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_cannot_delete(self):
        """Non-owner cannot delete dataset."""
        dataset = Dataset.objects.create(dataset_name="Owner Dataset", owner=self.owner)
        token = AccessToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.delete(f"{self.url}{dataset.dataset_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_can_view_if_granted(self):
        """Non-owner can view a dataset if granted permission."""
        dataset = Dataset.objects.create(dataset_name="Shared Dataset", owner=self.owner)
        # Grant access
        DatasetPermission.objects.create(dataset=dataset, user=self.other_user)
        token = AccessToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(f"{self.url}{dataset.dataset_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_owner_cannot_view_if_not_granted(self):
        """Non-owner cannot view dataset if not granted permission."""
        dataset = Dataset.objects.create(dataset_name="Private Dataset", owner=self.owner)
        token = AccessToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(f"{self.url}{dataset.dataset_id}/")
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    # -----------------------
    # Invalid data tests
    # -----------------------
    def test_create_dataset_missing_name(self):
        """Creation fails with missing dataset_name."""
        data = {}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dataset_name", response.data)