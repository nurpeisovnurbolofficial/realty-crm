"""Describes the cookie-based JWT auth in the OpenAPI schema (Swagger)."""

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = 'accounts.authentication.CookieJWTAuthentication'
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': settings.JWT_ACCESS_COOKIE,
            'description': 'Log in via POST /api/auth/login/ — the access token is stored in an httpOnly cookie.',
        }
