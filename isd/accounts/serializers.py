from django.contrib.auth.models import User, Group
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    """Serializer for Django User model using Groups for roles."""
    
    role = serializers.CharField(write_only=True, required=False)
    groups = serializers.StringRelatedField(many=True, read_only=True)
    
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "password", "groups", "role", "date_joined", "is_active"]
        extra_kwargs = {
            'password': {'write_only': True},
            'id': {'read_only': True}
        }
    
    def create(self, validated_data):
        role = validated_data.pop('role', 'user')
        user = User.objects.create_user(**validated_data)
        
        # Assign user to role group
        if role:
            group, created = Group.objects.get_or_create(name=role)
            user.groups.add(group)
        
        return user
    
    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            if attr != 'password':
                setattr(instance, attr, value)
            else:
                instance.set_password(value)
        instance.save()
        
        # Update role group if provided
        if role:
            # Remove from all existing groups
            instance.groups.clear()
            # Add to new role group
            group, created = Group.objects.get_or_create(name=role)
            instance.groups.add(group)
        
        return instance