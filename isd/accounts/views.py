from django.contrib.auth.models import User
from .serializers import UserSerializer
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

# Create your views here.
class IsSelf(permissions.BasePermission):
    """
    Custom permission: only allow users to access or modify their own data.
    """
    def has_object_permission(self, request, view, obj):
        return obj == request.user

class UserViewSet(viewsets.ModelViewSet):
    """
    Handles user profile CRUD operations with self-access permissions.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsSelf]

    def get_queryset(self):
        # Only return the authenticated user
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=["get", "put", "patch"], url_path='me')
    def me(self, request):
        """
        GET: return the authenticated user's profile
        PUT/PATCH: update the authenticated user's profile
        """
        if request.method == "GET":
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        elif request.method in ["PUT", "PATCH"]:
            serializer = self.get_serializer(request.user, data=request.data, partial=(request.method == "PATCH"))
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)