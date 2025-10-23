from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth.models import User
from predictors.models import Predictor, Dataset
from unittest.mock import patch

class RetrainPredictorTests(APITestCase):
    def setUp(self):
        # Create user and authenticate
        self.user = User.objects.create_user(username="tester", password="password123")
        self.client = APIClient()
        self.client.login(username="tester", password="password123")

        # Create a dummy dataset
        self.dataset = Dataset.objects.create(
            dataset_name="Test Dataset",
            owner=self.user,
            notes= "A test dataset"
        )

        # Create a predictor owned by this user
        self.predictor = Predictor.objects.create(
            name="My Predictor",
            description="Base predictor",
            dataset=self.dataset,
            owner=self.user,
            is_private=False
            time_unit="week",
            regularization="l2",
            mtlr_predictor="stable"
        )

        self.url = reverse("predictor-retrain", kwargs={"pk": self.predictor.pk})


    @patch("predictors.views.retrain_predictor_task.delay")
    def test_retrain_creates_celery_task(self, mock_delay):
        mock_delay.return_value.id = "fake-task-id-123"

        payload = {
            "settings": {"regularization": "l1"},
            "features": ["age", "bmi"]
        }

        response = self.client.post(self.url, payload, format="json")

        # Assert response
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("task_id", response.data)
        self.assertEqual(response.data["task_id"], "fake-task-id-123")
        self.assertIn(response.data["status"], ["queued"])
        self.assertIn(response.data["action"], ["replace", "create"])

        # Assert task was queued
        mock_delay.assert_called_once_with(
            self.predictor.id,
            payload["settings"],
            payload["features"],
            replace=False  # because settings changed
        )


    def test_non_owner_cannot_retrain(self):
        other_user = User.objects.create_user(username="intruder", password="pass")
        self.client.logout()
        self.client.login(username="intruder", password="pass")

        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    @patch("predictors.views.retrain_predictor_task.delay")
    def test_retrain_with_no_changes_replaces_predictor(self, mock_delay):
        mock_delay.return_value.id = "fake-task-id-999"

        payload = {
            "settings": {  # same as original
                "regularization": self.predictor.regularization,
                "time_unit": self.predictor.time_unit,
                "mtlr_predictor": self.predictor.mtlr_predictor,
            },
            "features": []
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["action"], "replace")
