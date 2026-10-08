"""Login with httpOnly JWT cookies, CSRF protection and brute-force throttling."""

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from accounts.models import User


class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttling counters live in the cache
        self.user = User.objects.create_user('daniyar', password='pass-12345', first_name='Daniyar')

    def login(self, client=None, password='pass-12345'):
        return (client or self.client).post('/api/auth/login/', {'username': 'daniyar', 'password': password})

    def test_login_sets_httponly_cookies_and_returns_user(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'daniyar')
        access = response.cookies['access_token']
        refresh = response.cookies['refresh_token']
        self.assertTrue(access['httponly'])
        self.assertTrue(refresh['httponly'])
        self.assertEqual(refresh['path'], '/api/auth/')  # the refresh token is not sent to the rest of the API
        self.assertNotIn('access', response.data)  # tokens are never exposed to JavaScript

    def test_cookie_authenticates_api_requests(self):
        self.login()
        self.assertEqual(self.client.get('/api/auth/me/').data['username'], 'daniyar')

    def test_wrong_password(self):
        response = self.login(password='wrong')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_credentials')

    def test_refresh_issues_a_new_access_token(self):
        self.login()
        self.client.cookies.pop('access_token')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/refresh/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

    def test_refresh_without_cookie_fails_cleanly(self):
        response = self.client.post('/api/auth/refresh/')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'session_expired')

    def test_logout_clears_cookies(self):
        self.login()
        self.client.post('/api/auth/logout/')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_csrf_is_required_for_cookie_authenticated_writes(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').cookies['csrftoken'].value
        client.post('/api/auth/login/', {'username': 'daniyar', 'password': 'pass-12345'}, HTTP_X_CSRFTOKEN=csrf)

        without = client.post('/api/clients/', {'name': 'A', 'phone': '1'})
        self.assertEqual(without.status_code, 403)
        with_token = client.post('/api/clients/', {'name': 'A', 'phone': '1'}, HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(with_token.status_code, 201)

    def test_login_is_throttled(self):
        for _ in range(10):
            self.login(password='wrong')
        self.assertEqual(self.login().status_code, 429)

    @override_settings(DEBUG=False)
    def test_spa_fallback_does_not_catch_api_urls(self):
        self.assertEqual(self.client.get('/api/no-such-endpoint/').status_code, 404)

    def test_logout_revokes_the_refresh_token(self):
        self.login()
        stolen_refresh = self.client.cookies['refresh_token'].value
        self.client.post('/api/auth/logout/')
        self.client.cookies['refresh_token'] = stolen_refresh
        self.assertEqual(self.client.post('/api/auth/refresh/').status_code, 401)

    def test_used_refresh_token_cannot_be_reused(self):
        self.login()
        old_refresh = self.client.cookies['refresh_token'].value
        self.assertEqual(self.client.post('/api/auth/refresh/').status_code, 204)  # rotates the token
        self.client.cookies['refresh_token'] = old_refresh
        self.assertEqual(self.client.post('/api/auth/refresh/').status_code, 401)

    def test_me_reports_demo_mode(self):
        self.login()
        self.assertIn('demo_mode', self.client.get('/api/auth/me/').data)

    @override_settings(DEMO_MODE=False)
    def test_demo_accounts_are_hidden_outside_demo_mode(self):
        User.objects.create_user('aliya', password='x', role=User.Role.HEAD)
        self.assertEqual(self.client.get('/api/auth/demo-accounts/').data, [])

    def test_admin_login_is_locked_after_repeated_failures(self):
        User.objects.create_superuser('boss', password='right-pass-123')
        for _ in range(5):
            response = self.client.post('/admin/login/', {'username': 'boss', 'password': 'nope'})
            self.assertEqual(response.status_code, 200)
        locked = self.client.post('/admin/login/', {'username': 'boss', 'password': 'right-pass-123'})
        self.assertEqual(locked.status_code, 429)

    def test_admin_login_success_resets_the_counter(self):
        User.objects.create_superuser('boss', password='right-pass-123')
        for _ in range(4):
            self.client.post('/admin/login/', {'username': 'boss', 'password': 'nope'})
        ok = self.client.post('/admin/login/', {'username': 'boss', 'password': 'right-pass-123'})
        self.assertEqual(ok.status_code, 302)
        self.client.logout()
        for _ in range(4):
            response = self.client.post('/admin/login/', {'username': 'boss', 'password': 'nope'})
            self.assertEqual(response.status_code, 200)

    def test_demo_accounts_endpoint_lists_only_demo_users(self):
        User.objects.create_user('aliya', password='x', role=User.Role.HEAD)
        User.objects.create_user('real-employee', password='x')
        data = self.client.get('/api/auth/demo-accounts/').data
        self.assertEqual([a['username'] for a in data], ['aliya', 'daniyar'])  # head first
