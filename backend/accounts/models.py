from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """An agency employee. The role decides what data they can see and change."""

    class Role(models.TextChoices):
        MANAGER = 'manager', 'Manager'
        HEAD = 'head', 'Head of sales'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MANAGER)

    @property
    def is_head(self):
        return self.role == self.Role.HEAD or self.is_superuser

    @property
    def display_name(self):
        return self.get_full_name() or self.username
