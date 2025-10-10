from django.contrib import admin
from .models import Dataset, DatasetPermission


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ('dataset_id', 'dataset_name', 'owner')
    list_filter = ('owner',)
    search_fields = ('dataset_name',)


@admin.register(DatasetPermission)
class DatasetPermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'dataset', 'user')
    list_filter = ('dataset', 'user')
