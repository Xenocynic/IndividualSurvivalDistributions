from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from predictors.models import Predictor, Dataset
from unittest.mock import patch
from rest_framework_simplejwt.tokens import AccessToken

class RetrainPredictorTests(APITestCase):
    def setUp(self):
        """Set up test users, dataset, and auth tokens."""
        self.owner = User.objects.create_user(username="owner", password="password123")
        self.other_user = User.objects.create_user(username="other", password="password123")
        self.dataset = Dataset.objects.create(dataset_name="Dataset A", owner=self.owner)

        # JWT tokens
        self.owner_token = str(AccessToken.for_user(self.owner))
        self.other_token = str(AccessToken.for_user(self.other_user))

        # Create a predictor owned by the owner
        self.predictor = Predictor.objects.create(
            name="My Predictor",
            description="Base predictor",
            dataset=self.dataset,
            owner=self.owner,
            is_private=False,
            time_unit="week",
            regularization="l2",
            mtlr_predictor="stable"
        )

        self.url = reverse("predictors-retrain", kwargs={"pk": self.predictor.pk})

    @patch("predictors.views.retrain_predictor_task.delay")
    def test_retrain_creates_celery_task(self, mock_delay):
        """Test retrain queues Celery task when settings/features changed."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        mock_delay.return_value.id = "fake-task-id-123"

        payload = {
            "settings": {
                "Regularization": "L1",
                "Objective function": "log-likelihood",
                "C-param": "fine",
                "Time unit": "week"
            },
            "features": ["age", "weight", "height", "blood_pressure"]
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("task_id", response.data)
        self.assertEqual(response.data["task_id"], "fake-task-id-123")
        self.assertIn(response.data["status"], ["queued"])
        self.assertIn(response.data["action"], ["replace", "create"])

        mock_delay.assert_called_once_with(
            self.predictor.predictor_id,
            payload["settings"],
            payload["features"],
            replace=False
        )

    def test_non_owner_cannot_retrain(self):
        """Ensure a non-owner receives 403 forbidden when they try to retrain a predictor they don't own."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.other_token}")
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("predictors.views.retrain_predictor_task.delay")
    def test_retrain_with_no_changes_replaces_predictor(self, mock_delay):
        """If settings/features unchanged, retrain should replace the predictor."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.owner_token}")
        mock_delay.return_value.id = "fake-task-id-999"

        payload = {
            "settings": {},
            "features": []
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["action"], "replace")
