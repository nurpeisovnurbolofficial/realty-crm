"""Helpers against password guessing that are not covered by DRF throttling (the Django admin login)."""

from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse


def client_ip(request):
    """The visitor's IP. Behind the hosting proxy the real IP is the LAST X-Forwarded-For value."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if settings.RENDER_EXTERNAL_HOSTNAME and forwarded:
        return forwarded.split(',')[-1].strip()  # earlier values can be faked by the client
    return request.META.get('REMOTE_ADDR', '')


def throttle_admin_login(login_view):
    """
    Wrap django.contrib.admin's login view: after N failed attempts from one IP,
    further attempts are refused for a while. Success resets the counter.
    """

    @wraps(login_view)
    def wrapper(request, *args, **kwargs):
        key = f'admin-login-failures:{client_ip(request)}'
        if request.method == 'POST':
            if cache.get(key, 0) >= settings.ADMIN_LOGIN_MAX_FAILURES:
                minutes = settings.ADMIN_LOGIN_LOCKOUT_MINUTES
                return HttpResponse(f'Too many failed attempts. Try again in {minutes} minutes.', status=429)

        response = login_view(request, *args, **kwargs)

        if request.method == 'POST':
            if response.status_code == 302:  # redirected into the admin: success
                cache.delete(key)
            else:  # the form was shown again: wrong credentials
                cache.add(key, 0, timeout=settings.ADMIN_LOGIN_LOCKOUT_MINUTES * 60)
                cache.incr(key)
        return response

    return wrapper
