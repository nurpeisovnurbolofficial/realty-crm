from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from crm import views

router = DefaultRouter()
router.register('clients', views.ClientViewSet, basename='client')
router.register('properties', views.PropertyViewSet, basename='property')
router.register('deals', views.DealViewSet, basename='deal')
router.register('tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('api/meta/', views.MetaView.as_view(), name='meta'),
    path('api/', include(router.urls)),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger'),
    # Everything else is a page of the React app.
    re_path(r'^(?!api/|admin/|static/).*$', views.spa, name='spa'),
]
