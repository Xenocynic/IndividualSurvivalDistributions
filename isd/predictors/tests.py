from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken
from .models import Predictor, PinnedPredictor, PredictorPermission
from dataset.models import Dataset

# ----------------------------
# Helper to authenticate user via JWT
# ----------------------------
def authenticate(client, user):
    token = AccessToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

# ----------------------------
# Predictor Model Tests
# ----------------------------
class PredictorModelTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.user)
        self.predictor = Predictor.objects.create(
            name="Test Predictor",
            description="Test description",
            dataset=self.dataset,
            owner=self.user,
            is_private=True,
        )

    def test_predictor_str(self):
        self.assertEqual(str(self.predictor), "Test Predictor")

    def test_predictor_owner(self):
        self.assertEqual(self.predictor.owner, self.user)

# ----------------------------
# PredictorPermission Model Tests
# ----------------------------
class PredictorPermissionModelTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass")
        self.other_user = User.objects.create_user(username="other", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.owner)
        self.predictor = Predictor.objects.create(
            name="Test Predictor",
            description="Test description",
            dataset=self.dataset,
            owner=self.owner,
        )
        self.permission = PredictorPermission.objects.create(
            predictor=self.predictor, user=self.other_user
        )

    def test_permission_str(self):
        self.assertEqual(
            str(self.permission),
            f"{self.other_user.username} - {self.predictor.name}"
        )

# ----------------------------
# PinnedPredictor Model Tests
# ----------------------------
class PinnedPredictorModelTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="user", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.user)
        self.predictor = Predictor.objects.create(
            name="Pinned Predictor",
            description="Desc",
            dataset=self.dataset,
            owner=self.user,
        )
        self.pin = PinnedPredictor.objects.create(user=self.user, predictor=self.predictor)

    def test_pin_str(self):
        self.assertEqual(str(self.pin), f"{self.user.username} pinned {self.predictor.name}")

# ----------------------------
# Predictor ViewSet Tests
# ----------------------------
class PredictorViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.owner)
        self.predictor = Predictor.objects.create(
            name="Private Predictor",
            description="desc",
            dataset=self.dataset,
            owner=self.owner,
            is_private=True,
        )
        self.permission = PredictorPermission.objects.create(
            predictor=self.predictor, user=self.other
        )

    def test_owner_can_retrieve(self):
        authenticate(self.client, self.owner)
        url = reverse("predictors-detail", args=[self.predictor.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_shared_user_can_retrieve(self):
        authenticate(self.client, self.other)
        url = reverse("predictors-detail", args=[self.predictor.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_shared_user_cannot_retrieve(self):
        stranger = User.objects.create_user(username="stranger", password="pass")
        authenticate(self.client, stranger)
        url = reverse("predictors-detail", args=[self.predictor.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_update(self):
        authenticate(self.client, self.owner)
        url = reverse("predictors-detail", args=[self.predictor.pk])
        response = self.client.patch(url, {"name": "Updated Name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.predictor.refresh_from_db()
        self.assertEqual(self.predictor.name, "Updated Name")

    def test_non_owner_cannot_update(self):
        authenticate(self.client, self.other)
        url = reverse("predictors-detail", args=[self.predictor.pk])
        response = self.client.patch(url, {"name": "Hacked Name"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

# ----------------------------
# PredictorPermission ViewSet Tests
# ----------------------------
class PredictorPermissionViewSetTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass")
        self.user = User.objects.create_user(username="user", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.owner)
        self.predictor = Predictor.objects.create(
            name="Private Predictor", description="desc", dataset=self.dataset, owner=self.owner
        )

    def test_only_owner_can_create_permission(self):
        url = reverse("predictor-permission-list") 

        # Non-owner cannot create permission
        authenticate(self.client, self.user)
        response = self.client.post(url, {"predictor": self.predictor.pk, "user": self.user.pk})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Owner can create permission
        authenticate(self.client, self.owner)
        response = self.client.post(url, {"predictor": self.predictor.pk, "user": self.user.pk})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

# ----------------------------
# PinnedPredictor ViewSet Tests
# ----------------------------
class PinnedPredictorViewSetTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="user", password="pass")
        self.dataset = Dataset.objects.create(dataset_name="Dataset 1", owner=self.user)
        self.predictor = Predictor.objects.create(
            name="Pred", description="desc", dataset=self.dataset, owner=self.user
        )
        authenticate(self.client, self.user)

    def test_user_can_pin_predictor(self):
        url = reverse("predictors-pin", args=[self.predictor.pk]) 
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PinnedPredictor.objects.filter(user=self.user, predictor=self.predictor).exists())

    def test_user_can_unpin_predictor(self):
        PinnedPredictor.objects.create(user=self.user, predictor=self.predictor)
        url = reverse("predictors-unpin", args=[self.predictor.pk]) 
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(PinnedPredictor.objects.filter(user=self.user, predictor=self.predictor).exists())

    def test_list_pinned_predictors(self):
        PinnedPredictor.objects.create(user=self.user, predictor=self.predictor)
        url = reverse("pinned-predictor-list")  # Corrected URL
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Pred")

    def test_unpinned_predictors_not_returned(self):
        url = reverse("pinned-predictor-list") 
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
