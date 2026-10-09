from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, connection
from django.db.models import Count, Q
from django.http import FileResponse, Http404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import analytics, services
from .exceptions import api_error
from .filters import ClientFilter, DealFilter, PropertyFilter, TaskFilter
from .models import Client, Deal, Property, Task
from .serializers import (
    ActivitySerializer,
    ChangeOwnerSerializer,
    ClientSerializer,
    DealListSerializer,
    DealSerializer,
    MoveDealSerializer,
    NoteSerializer,
    PropertySerializer,
    TaskSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filterset_class = ClientFilter
    search_fields = ['name', 'phone', 'email', 'company_name']
    ordering_fields = ['name', 'created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):  # schema generation has no logged-in user
            return Client.objects.none()
        user = self.request.user
        # Count only the deals this user can see, so the number matches the list inside the client card.
        visible = Q() if user.is_head else Q(deals__owner=user)
        return services.visible_clients(user).annotate(deals_count=Count('deals', filter=visible))

    def perform_create(self, serializer):
        serializer.save(owner=serializer.validated_data.get('owner', self.request.user))

    def perform_destroy(self, instance):
        services.check_delete_allowed(self.request.user)
        if instance.deals.exists():
            raise services.DealError('client_has_deals', 'This client has deals and cannot be deleted.')
        instance.delete()


class CanEditProperty(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or services.can_edit_property(request.user, obj)


class PropertyViewSet(viewsets.ModelViewSet):
    """The listing catalog is shared by the whole agency; only the agent or the head can edit a listing."""

    serializer_class = PropertySerializer
    permission_classes = [permissions.IsAuthenticated, CanEditProperty]
    filterset_class = PropertyFilter
    search_fields = ['title', 'address', 'description']
    ordering_fields = ['price', 'area', 'created_at']
    queryset = Property.objects.select_related('agent')

    def perform_create(self, serializer):
        serializer.save(agent=serializer.validated_data.get('agent', self.request.user))

    def perform_destroy(self, instance):
        services.check_delete_allowed(self.request.user)
        if instance.deals.exists():
            raise services.DealError('property_has_deals', 'This property is used in deals and cannot be deleted.')
        instance.delete()


class DealViewSet(viewsets.ModelViewSet):
    filterset_class = DealFilter
    search_fields = ['title', 'client__name', 'property__title', 'property__address']
    ordering_fields = ['amount', 'updated_at', 'created_at', 'expected_close_date']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Deal.objects.none()
        return services.visible_deals(self.request.user).annotate(
            open_tasks=Count('tasks', filter=Q(tasks__is_done=False))
        )

    def get_serializer_class(self):
        return DealListSerializer if self.action in ('list', 'board') else DealSerializer

    def perform_create(self, serializer):
        data = serializer.validated_data
        data.setdefault('owner', self.request.user)
        serializer.instance = services.create_deal(self.request.user, **data)

    def perform_update(self, serializer):
        new_owner = serializer.validated_data.pop('owner', None)
        deal = serializer.save()
        if new_owner is not None and new_owner != deal.owner:
            services.change_owner(deal, new_owner, self.request.user)

    def perform_destroy(self, instance):
        if not self.request.user.is_head:
            raise PermissionDenied('Only the head of sales can delete deals.')
        services.check_delete_allowed(self.request.user)
        if instance.stage in services.STAGES_HOLDING_PROPERTY:
            raise services.DealError('property_locked', 'Move the deal back from the contract stage first.')
        instance.delete()

    @extend_schema(
        parameters=[OpenApiParameter('deal_type', str), OpenApiParameter('owner', int)],
        responses=DealListSerializer(many=True),
        description='All deals grouped by stage for the Kanban board. Closed deals: only the last 30 days.',
    )
    @action(detail=False, methods=['get'])
    def board(self, request):
        deals = self.filter_queryset(self.get_queryset())
        recent = timezone.now() - timedelta(days=30)
        deals = deals.exclude(Q(stage__in=Deal.CLOSED_STAGES) & Q(closed_at__lt=recent))
        data = DealListSerializer(deals, many=True).data
        columns = {stage: [] for stage in Deal.Stage.values}
        for item in data:
            columns[item['stage']].append(item)
        return Response(columns)

    @extend_schema(request=MoveDealSerializer, responses=DealSerializer)
    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        """Move the deal to another pipeline stage (drag and drop on the board)."""
        serializer = MoveDealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        deal = services.move_deal(
            self.get_object(),
            data['stage'],
            request.user,
            lost_reason=data['lost_reason'],
            lost_comment=data['lost_comment'],
        )
        return Response(DealSerializer(deal, context=self.get_serializer_context()).data)

    @extend_schema(request=ChangeOwnerSerializer, responses=DealSerializer)
    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        serializer = ChangeOwnerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deal = services.change_owner(self.get_object(), serializer.validated_data['owner'], request.user)
        return Response(DealSerializer(deal, context=self.get_serializer_context()).data)

    @extend_schema(methods=['get'], responses=ActivitySerializer(many=True))
    @extend_schema(methods=['post'], request=NoteSerializer, responses=ActivitySerializer)
    @action(detail=True, methods=['get', 'post'])
    def activities(self, request, pk=None):
        """GET: the deal history. POST: add a note."""
        deal = self.get_object()
        if request.method == 'POST':
            serializer = NoteSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            note = services.add_note(deal, request.user, serializer.validated_data['text'])
            return Response(ActivitySerializer(note).data, status=status.HTTP_201_CREATED)
        return Response(ActivitySerializer(deal.activities.select_related('author'), many=True).data)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    filterset_class = TaskFilter
    search_fields = ['title', 'deal__title']
    ordering_fields = ['due_at', 'created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Task.objects.none()
        return services.visible_tasks(self.request.user)

    def perform_create(self, serializer):
        serializer.save(assignee=serializer.validated_data.get('assignee', self.request.user))

    def perform_destroy(self, instance):
        services.check_delete_allowed(self.request.user)
        instance.delete()

    @extend_schema(request=None, responses=TaskSerializer)
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = services.set_task_done(self.get_object(), request.user, done=True)
        return Response(self.get_serializer(task).data)

    @extend_schema(request=None, responses=TaskSerializer)
    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        task = services.set_task_done(self.get_object(), request.user, done=False)
        return Response(self.get_serializer(task).data)

    @extend_schema(responses={200: dict}, description='Number of tasks in each tab: overdue, today, upcoming, done.')
    @action(detail=False, methods=['get'])
    def summary(self, request):
        tasks = self.get_queryset()
        task_filter = TaskFilter()
        return Response({when: task_filter.filter_when(tasks, 'when', when).count() for when in TaskFilter.WHEN_VALUES})


class DashboardView(APIView):
    @extend_schema(
        parameters=[OpenApiParameter('owner', int, description='Head only: show one manager.')],
        responses={200: dict},
    )
    def get(self, request):
        user = request.user
        deals = services.visible_deals(user)
        tasks = services.visible_tasks(user)
        owner_id = request.query_params.get('owner', '')
        if owner_id and user.is_head:
            if not owner_id.isdigit():
                return api_error('invalid_filter', 'The "owner" filter must be a user id.')
            deals = deals.filter(owner_id=owner_id)
            tasks = tasks.filter(assignee_id=owner_id)

        data = analytics.dashboard(deals, tasks)
        data['leaderboard'] = analytics.leaderboard(services.visible_deals(user)) if user.is_head else None
        return Response(data)


class HealthView(APIView):
    """Liveness check for the hosting platform: the app is up and the database answers."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: dict, 503: dict})
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
        except DatabaseError:
            return Response({'status': 'error', 'database': 'unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'status': 'ok'})


@ensure_csrf_cookie
def spa(request, *args, **kwargs):
    """Serve the React app for every non-API URL; React Router handles the page on the client."""
    index = settings.FRONTEND_DIST / 'index.html'
    if not index.exists():
        raise Http404('Frontend is not built. Run `npm run build` in frontend/ or use the Vite dev server.')
    response = FileResponse(index.open('rb'), content_type='text/html')
    # Always ask the server for a fresh index.html: after a deploy it points to new asset files.
    response['Cache-Control'] = 'no-cache'
    return response
