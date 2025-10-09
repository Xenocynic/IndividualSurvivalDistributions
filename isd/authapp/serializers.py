from django.contrib.auth.models import User, Group
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password

class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for registering new user.
    Handles validation for email uniqueness, password confirmation, amd password strength.
    """
    email = serializers.EmailField(required=True) 
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2')

    def validate_email(self, value):
        # Check that the email is unique across users
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate(self, attrs):
        # Check if passwords match
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        # Validate password strength
        validate_password(attrs["password"])
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')  # Remove the extra confirmation field
        user = User.objects.create_user(**validated_data)
        return user

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