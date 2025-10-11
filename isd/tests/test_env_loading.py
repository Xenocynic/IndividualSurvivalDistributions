from django.test import TestCase
from django.conf import settings
import os
from pathlib import Path

class EnvLoadingTests(TestCase):
    def test_env_file_exists(self):
        env_path = Path(settings.BASE_DIR) / '.env'
        self.assertTrue(env_path.exists(), ".env file is missing")

    def test_email_host_password_loaded(self):
        value = os.environ.get('EMAIL_HOST_PASSWORD', None)
        self.assertIsNotNone(value, "EMAIL_HOST_PASSWORD should be loaded from .env")
        self.assertNotEqual(value, "", "EMAIL_HOST_PASSWORD should not be empty")

    def test_email_host_password_matches_settings(self):
        env_value = os.environ.get('EMAIL_HOST_PASSWORD')
        self.assertEqual(env_value, settings.EMAIL_HOST_PASSWORD)
