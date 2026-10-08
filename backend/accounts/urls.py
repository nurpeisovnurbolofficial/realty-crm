from django.urls import path

from . import views

urlpatterns = [
    path('auth/csrf/', views.CsrfView.as_view(), name='auth-csrf'),
    path('auth/login/', views.LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', views.RefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('auth/demo-accounts/', views.DemoAccountsView.as_view(), name='auth-demo-accounts'),
    path('auth/me/', views.MeView.as_view(), name='auth-me'),
    path('users/', views.UserListView.as_view(), name='user-list'),
]
