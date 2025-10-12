import pytest

@pytest.fixture(autouse=True)
def use_in_memory_email_backend(settings):
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
