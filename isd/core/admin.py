from django.contrib import admin
from .models import User, Dataset, Predictor, DatasetPermission, PredictorPermission


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'user_name', 'email_address', 'role')
    list_filter = ('role',)
    search_fields = ('user_name', 'email_address')


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ('dataset_id', 'dataset_name', 'owner')
    list_filter = ('owner',)
    search_fields = ('dataset_name',)


@admin.register(Predictor)
class PredictorAdmin(admin.ModelAdmin):
    list_display = ('predictor_id', 'name', 'dataset', 'owner')
    list_filter = ('dataset', 'owner')
    search_fields = ('name', 'description')


@admin.register(DatasetPermission)
class DatasetPermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'dataset', 'user')
    list_filter = ('dataset', 'user')


@admin.register(PredictorPermission)
class PredictorPermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'predictor', 'user')
    list_filter = ('predictor', 'user')
