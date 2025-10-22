from django.urls import path
from .views import get_task_status

urlpatterns = [
    path("<uuid:task_id>/status/", get_task_status),
]
