from django.conf import settings
from django.contrib.auth import authenticate
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from crm.exceptions import api_error

from .authentication import enforce_csrf
from .models import User
from .serializers import LoginSerializer, UserSerializer

DEMO_PASSWORD = 'demo-pass-2026'


def _set_auth_cookies(response, access, refresh=None):
    options = {
        'httponly': True,
        'secure': settings.JWT_COOKIE_SECURE,
        'samesite': settings.JWT_COOKIE_SAMESITE,
    }
    lifetime = settings.SIMPLE_JWT
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE,
        access,
        max_age=int(lifetime['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        **options,
    )
    if refresh:
        # The refresh cookie is only sent to the auth endpoints, never to the rest of the API.
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE,
            refresh,
            max_age=int(lifetime['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            path='/api/auth/',
            **options,
        )


class AuthView(APIView):
    """Base for auth endpoints: no token required, but CSRF is still checked."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            enforce_csrf(request._request)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(AuthView):
    """Sets the csrftoken cookie. The frontend calls it once before the first POST."""

    @extend_schema(responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginView(AuthView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    @extend_schema(request=LoginSerializer, responses=UserSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            return api_error('invalid_credentials', 'Wrong username or password.', status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data)
        _set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class RefreshView(AuthView):
    """Issues a new access token (and rotates the refresh token) using the refresh cookie."""

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        serializer = TokenRefreshSerializer(data={'refresh': request.COOKIES.get(settings.JWT_REFRESH_COOKIE, '')})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return api_error('session_expired', 'Your session has expired. Please log in again.', 401)
        except Exception:  # missing or malformed cookie
            return api_error('session_expired', 'Your session has expired. Please log in again.', 401)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        _set_auth_cookies(response, serializer.validated_data['access'], serializer.validated_data.get('refresh'))
        return response


class LogoutView(AuthView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.JWT_ACCESS_COOKIE, samesite=settings.JWT_COOKIE_SAMESITE)
        response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/api/auth/', samesite=settings.JWT_COOKIE_SAMESITE)
        return response


class DemoAccountsView(AuthView):
    """Public list of demo accounts for the one-click login buttons."""

    @extend_schema(responses={200: dict})
    def get(self, request):
        accounts = User.objects.filter(username__in=['aliya', 'daniyar']).order_by(
            'role'
        )  # 'head' sorts before 'manager'
        return Response(
            [{'username': user.username, 'role': user.role, 'password': DEMO_PASSWORD} for user in accounts]
        )


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """Active employees: used for 'responsible manager' dropdowns and filters."""

    serializer_class = UserSerializer
    pagination_class = None
    queryset = User.objects.filter(is_active=True).order_by('first_name', 'username')
