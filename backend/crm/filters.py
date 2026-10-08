import django_filters
from django.db.models import Q
from django.utils import timezone

from .models import Client, Deal, Property, Task


class ClientFilter(django_filters.FilterSet):
    class Meta:
        model = Client
        fields = ['kind', 'source', 'owner']


class PropertyFilter(django_filters.FilterSet):
    price_min = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    price_max = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    rooms_min = django_filters.NumberFilter(field_name='rooms', lookup_expr='gte')
    area_min = django_filters.NumberFilter(field_name='area', lookup_expr='gte')
    status = django_filters.MultipleChoiceFilter(choices=Property.Status.choices)

    class Meta:
        model = Property
        fields = ['kind', 'deal_type', 'district', 'status', 'agent']


class DealFilter(django_filters.FilterSet):
    class Meta:
        model = Deal
        fields = ['stage', 'deal_type', 'owner', 'client', 'property']


class TaskFilter(django_filters.FilterSet):
    """?when=overdue|today|upcoming|done — the tabs on the Tasks page."""

    when = django_filters.ChoiceFilter(
        method='filter_when',
        choices=[('overdue', 'Overdue'), ('today', 'Today'), ('upcoming', 'Upcoming'), ('done', 'Done')],
    )

    class Meta:
        model = Task
        fields = ['deal', 'assignee', 'is_done']

    def filter_when(self, queryset, name, value):
        now = timezone.now()
        today_end = timezone.localtime(now).replace(hour=23, minute=59, second=59, microsecond=999999)
        if value == 'done':
            return queryset.filter(is_done=True).order_by('-completed_at')
        open_tasks = queryset.filter(is_done=False)
        if value == 'overdue':
            return open_tasks.filter(due_at__lt=now)
        if value == 'today':
            return open_tasks.filter(Q(due_at__gte=now) & Q(due_at__lte=today_end))
        return open_tasks.filter(due_at__gt=today_end)
