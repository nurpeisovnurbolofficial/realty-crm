"""
JWT authentication that reads the access token from an httpOnly cookie.

Why cookies and not localStorage: JavaScript cannot read an httpOnly cookie, so even if
an attacker manages to run a script on the page (XSS), they cannot steal the token.
The price: the browser sends cookies automatically, which opens the door to CSRF
(another site making a request on the user's behalf). So every unsafe request
(POST/PUT/PATCH/DELETE) must also carry Django's CSRF token in a header.
"""

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason  # return the reason instead of an HTML 403 page


def enforce_csrf(request):
    """Raise 403 if a cookie-authenticated unsafe request has no valid CSRF token."""
    check = _CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if raw_token is None:
            return None  # not logged in: permission classes will answer 401

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        enforce_csrf(request._request)
        return user, validated_token

    def authenticate_header(self, request):
        # Makes DRF answer 401 (not 403) for missing/expired tokens, so the frontend knows to refresh.
        return 'Bearer realm="api"'
