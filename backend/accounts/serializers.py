from django.conf import settings
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    is_head = serializers.BooleanField(read_only=True)
    demo_mode = serializers.SerializerMethodField(help_text='True on the public demo: deleting is disabled.')

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'display_name', 'role', 'is_head', 'demo_mode']

    def get_demo_mode(self, obj) -> bool:
        return settings.DEMO_MODE


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(style={'input_type': 'password'})
