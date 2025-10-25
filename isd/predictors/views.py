from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Predictor, PredictorPermission, PinnedPredictor
from .serializers import PredictorSerializer, PredictorPermissionSerializer, PinnedPredictorSerializer

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def resolve_username(request):
    username = request.query_params.get("username")
    if not username:
        return Response({"detail": "username required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(username=username)
        return Response({"id": user.id})
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def grant_predictor_permission(request):
    predictor_id = request.data.get("predictor")
    user_id = request.data.get("user")
    role = request.data.get("permission")

    try:
        predictor = Predictor.objects.get(pk=predictor_id)
    except Predictor.DoesNotExist:
        return Response({"error": "Predictor not found"}, status=404)
    
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

    if predictor.owner != request.user:
        return Response({"error": "Only the owner can grant permissions"}, status=403)
    
    perm, created = PredictorPermission.objects.update_or_create(
        predictor=predictor,
        user=user,
        defaults={"role": role}
    )
    return Response({"success": True, "permission_id": perm.id})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_pinned_predictors(request):
    pinned = PinnedPredictor.objects.filter(user=request.user).select_related("predictor")
    # Only return the predictor info that your frontend expects
    data = [
        {
            "id": str(p.predictor.id),  # note: predictor id, not pinned record id
            "title": p.predictor.name,
            "owner_name": p.predictor.owner.username,
            "isPublic": not p.predictor.is_private,
            "updatedAt": p.predictor.updated_at.isoformat() if p.predictor.updated_at else "",
        }
        for p in pinned
    ]
    user = request.user
    print("User requesting pinned:", user)
    print("Pinned predictors returned:", pinned)
    return Response(data)


# ----------------------------
# Custom Permissions
# ----------------------------
class IsPredictorOwner(permissions.BasePermission):
    """Only predictor owners can update/delete"""
    def has_object_permission(self, request, view, obj):
        if obj.owner == request.user:
            return True
        # Users assigned as 'owner' in permissions
        return PredictorPermission.objects.filter(
            predictor=obj, user=request.user, role='owner'
        ).exists()


class CanAccessPredictor(permissions.BasePermission):
    """Allow view if owner, has permission, or predictor is public"""
    def has_object_permission(self, request, view, obj):
        # Owner always has access
        if obj.owner == request.user:
            return True
        # Users can access public predictors
        if obj.is_private == False:
            return True
        if PredictorPermission.objects.filter(predictor=obj, user=request.user).exists():
            return True
        return False


# ----------------------------
# Predictor ViewSet
# ----------------------------
class PredictorViewSet(viewsets.ModelViewSet):
    """API viewset for Predictor model with proper access control."""

    serializer_class = PredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returns predictors the user owns, has been granted access to, or are public.
        - Owned predictors: user is the owner
        - Shared predictors: user has PredictorPermission
        - Public predictors: is_private=False
        """
        user = self.request.user
        return (
            Predictor.objects.filter(Q(owner=user) | Q(permissions__user=user))
            .distinct()
            .prefetch_related("permissions", "pinned_by")
            .order_by("name")
        )

    def get_object(self):
        """
        Override to run permission checks first, so unauthorized users get 403 instead of 404.
        (Basically sends 403 to let us know object exists, user just doesn't have access)
        """
        # Get the object from all predictors, not just the filtered queryset
        queryset = Predictor.objects.all()
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        
        try:
            obj = queryset.get(**filter_kwargs)
        except Predictor.DoesNotExist:
            from django.http import Http404
            raise Http404("No Predictor matches the given query.")
        
        self.check_object_permissions(self.request, obj)
        return obj
        return Predictor.objects.filter(
            Q(owner=user) | Q(permissions__user=user) | Q(is_private=False)
        ).distinct().order_by("name")


    def get_permissions(self):
        """
        Assign permissions based on the action being performed:
        - update/partial_update/destroy: must be the owner
        - retrieve: owner or shared
        - list/create: any authenticated user
        """
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsPredictorOwner()]
        elif self.action == "retrieve":
            return [CanAccessPredictor()]
        return super().get_permissions()


    def perform_create(self, serializer):
        """Assign the logged-in user as the owner."""
        print("RAW request.data:", self.request.data)
        predictor = serializer.save()
        # Automatically create 'owner' permission for this user
        perm = PredictorPermission.objects.create(
            predictor=predictor,
            user=self.request.user,
            role='owner'
        )

        print("Owner permission added:", perm)

        # Add extra permissions
        try:
            permissions_data = self.request.data.get("permissions", [])
            for perm_data in permissions_data:
                username = perm_data.get("username")
                role = perm_data.get("role")
                if not username or role not in ["owner", "viewer"]:
                    print("Skipping invalid permission:", perm_data)
                    continue
                try:
                    user = User.objects.get(username=username)
                except User.DoesNotExist:
                    print("User not found:", username)
                    continue
                try:
                    p, created = PredictorPermission.objects.update_or_create(
                        predictor=predictor,
                        user=user,
                        defaults={"role": role}
                    )
                    print(f"Added/updated permission for {username}: {p}, created={created}")
                except Exception as e:
                    print("Failed to add permission:", perm_data, e)
        except Exception as e:
            print("perform_create failed:", e)

    @action(detail=True, methods=["post"])
    def pin(self, request, pk=None):
        """
        Pin a predictor for quick access.
        Only allowed if the user can access the predictor.
        """
        predictor = self.get_object()
        if not CanAccessPredictor().has_object_permission(request, self, predictor):
            raise PermissionDenied("You do not have permission to pin this predictor.")
        PinnedPredictor.objects.get_or_create(user=request.user, predictor=predictor)
        return Response({"status": "pinned"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def unpin(self, request, pk=None):
        """
        Unpin a predictor.
        Only allowed if the user can access the predictor.
        """
        predictor = self.get_object()
        if not CanAccessPredictor().has_object_permission(request, self, predictor):
            raise PermissionDenied("You do not have permission to unpin this predictor.")
        PinnedPredictor.objects.filter(user=request.user, predictor=predictor).delete()
        return Response({"status": "unpinned"}, status=status.HTTP_200_OK)
    

# ----------------------------
# PredictorPermission ViewSet
# ----------------------------
class PredictorPermissionViewSet(viewsets.ModelViewSet):
    """API viewset for PredictorPermission model with proper access control."""

    serializer_class = PredictorPermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Only show permissions for predictors the current user owns.
        This ensures a user cannot see or modify permissions for predictors they don't own.
        """
        return PredictorPermission.objects.filter(predictor__owner=self.request.user)

    def perform_create(self, serializer):
        """
        Assign the logged-in user as the owner and optionally
        add extra permissions from the request data.
        Expects request.data to include 'permissions' key:
        [
            {"username": "alice", "role": "owner"},
            {"username": "bob", "role": "viewer"}
        ]
        """
        # Save predictor with the creator as owner
        print("RAW request.data:", self.request.data)
        serializer.save()

    def perform_destroy(self, instance):
        """
        Ensure only the predictor owner can revoke access.
        Raises PermissionDenied if the request user is not the owner.
        """
        if instance.predictor.owner != self.request.user:
            raise PermissionDenied("Only the predictor owner can revoke access.")
        instance.delete()

# ----------------------------
# PinnedPredictor ViewSet
# ----------------------------
class PinnedPredictorViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing pinned predictors.
    - GET: list pinned predictors
    - POST: pin a predictor
    - DELETE: unpin a predictor
    """
    serializer_class = PinnedPredictorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Return predictors pinned by the current user.
        """
        return PinnedPredictor.objects.filter(user=self.request.user).order_by("-pinned_at")

    def perform_create(self, serializer):
        """Automatically assign the current user when pinning"""
        serializer.save(user=self.request.user)

        
# ----------------------------
# Public Predictor Views
# ----------------------------
@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def list_public_predictors(request):
    """
    List all public predictors without authentication.
    Returns only predictors where is_private=False.
    """
    try:
        # Get all public predictors (where is_private=False)
        public_predictors = Predictor.objects.filter(is_private=False).order_by('name')
        
        # Serialize the data
        serializer = PredictorSerializer(public_predictors, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {
                'error': 'Failed to fetch public predictors',
                'message': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )