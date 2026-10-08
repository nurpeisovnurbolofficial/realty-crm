from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from accounts.security import throttle_admin_login
from crm import views

router = DefaultRouter()
router.register('clients', views.ClientViewSet, basename='client')
router.register('properties', views.PropertyViewSet, basename='property')
router.register('deals', views.DealViewSet, basename='deal')
router.register('tasks', views.TaskViewSet, basename='task')

# Lock the admin login after repeated wrong passwords (DRF throttling does not cover Django admin).
admin.site.login = throttle_admin_login(admin.site.login)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('api/health/', views.HealthView.as_view(), name='health'),
    path('api/', include(router.urls)),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger'),
    # Everything else is a page of the React app.
    re_path(r'^(?!api/|admin/|static/).*$', views.spa, name='spa'),
]
