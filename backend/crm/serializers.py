from django.utils import timezone
from rest_framework import serializers

from accounts.models import User

from .models import Activity, Client, Deal, Property, Task
from .services import STAGES_HOLDING_PROPERTY, DealError, check_property_matches, visible_clients, visible_deals


class UserShortSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'display_name', 'role']


class OwnerFieldMixin:
    """
    The responsible person (owner/agent/assignee) is always the current user for managers.
    Only the head may set it to someone else.
    """

    owner_field = 'owner'

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context['request'].user
        if self.owner_field in attrs and not user.is_head and attrs[self.owner_field] != user:
            raise serializers.ValidationError({self.owner_field: 'Only the head of sales can assign other people.'})
        return attrs


# --- Clients ------------------------------------------------------------------


class ClientSerializer(OwnerFieldMixin, serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    owner_info = UserShortSerializer(source='owner', read_only=True)
    deals_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = [
            'id', 'name', 'kind', 'company_name', 'phone', 'email', 'source', 'notes',
            'owner', 'owner_info', 'deals_count', 'created_at',
        ]  # fmt: skip


class ClientShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'phone', 'kind']


# --- Properties ---------------------------------------------------------------


class PropertySerializer(OwnerFieldMixin, serializers.ModelSerializer):
    owner_field = 'agent'
    agent = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    agent_info = UserShortSerializer(source='agent', read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            'id', 'title', 'kind', 'deal_type', 'district', 'address', 'rooms', 'area', 'floor', 'price',
            'status', 'description', 'agent', 'agent_info', 'can_edit', 'created_at',
        ]  # fmt: skip

    def get_can_edit(self, obj) -> bool:
        user = self.context['request'].user
        return user.is_head or obj.agent_id == user.id

    def validate_status(self, value):
        # "Reserved" belongs to the deal pipeline: it cannot be set by hand, and a reserved
        # property cannot be released by hand while a deal holds it under contract.
        current = self.instance.status if self.instance else None
        if value != current and Property.Status.RESERVED in (value, current):
            raise DealError('status_managed_by_deals', 'The "reserved" status is set automatically by deals.')
        return value

    def validate_deal_type(self, value):
        # Switching sale <-> rent would break deals that already work with this property.
        if self.instance and value != self.instance.deal_type:
            if self.instance.deals.exclude(stage__in=Deal.CLOSED_STAGES).exists():
                raise DealError('property_in_use', 'The property is used in open deals: its deal type cannot change.')
        return value


class PropertyShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = ['id', 'title', 'kind', 'deal_type', 'district', 'price', 'status']


# --- Deals --------------------------------------------------------------------


class DealListSerializer(serializers.ModelSerializer):
    client = ClientShortSerializer(read_only=True)
    property = PropertyShortSerializer(read_only=True)
    owner = UserShortSerializer(read_only=True)
    commission = serializers.IntegerField(read_only=True)
    open_tasks = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Deal
        fields = [
            'id', 'title', 'client', 'property', 'deal_type', 'stage', 'amount', 'commission',
            'owner', 'expected_close_date', 'open_tasks', 'updated_at',
        ]  # fmt: skip


class DealSerializer(OwnerFieldMixin, serializers.ModelSerializer):
    """Create / update / detail. The stage is changed only through the `move` action."""

    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    property = serializers.PrimaryKeyRelatedField(queryset=Property.objects.all(), allow_null=True, required=False)
    owner = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    client_info = ClientShortSerializer(source='client', read_only=True)
    property_info = PropertyShortSerializer(source='property', read_only=True)
    owner_info = UserShortSerializer(source='owner', read_only=True)
    commission = serializers.IntegerField(read_only=True)

    class Meta:
        model = Deal
        fields = [
            'id', 'title', 'client', 'client_info', 'property', 'property_info', 'deal_type', 'stage',
            'amount', 'commission_percent', 'commission', 'owner', 'owner_info', 'lost_reason',
            'expected_close_date', 'closed_at', 'created_at', 'updated_at',
        ]  # fmt: skip
        read_only_fields = ['stage', 'lost_reason', 'closed_at']
        # DRF would turn the conditional DB constraint into a "property is required" rule.
        # The constraint is enforced by services.move_deal and the database itself.
        validators = []

    def validate_client(self, client):
        # The deal's current client is always fine: the head may have reassigned the deal to this manager.
        if self.instance and client.pk == self.instance.client_id:
            return client
        # A manager cannot attach someone else's client (and cannot learn that it exists).
        if not visible_clients(self.context['request'].user).filter(pk=client.pk).exists():
            raise serializers.ValidationError('Client not found.')
        return client

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        deal_type = attrs.get('deal_type', instance.deal_type if instance else 'sale')
        prop = attrs['property'] if 'property' in attrs else (instance.property if instance else None)
        check_property_matches(deal_type, prop)

        if instance and instance.stage in STAGES_HOLDING_PROPERTY:
            changed = ('property' in attrs and attrs['property'] != instance.property) or (
                'deal_type' in attrs and attrs['deal_type'] != instance.deal_type
            )
            if changed:
                raise DealError('property_locked', 'Move the deal back from the contract stage to change the property.')
        if instance and instance.is_closed and not self.context['request'].user.is_head:
            raise DealError('reopen_requires_head', 'Only the head of sales can change a closed deal.')
        return attrs


class MoveDealSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=Deal.Stage.choices)
    lost_reason = serializers.CharField(required=False, allow_blank=True, max_length=200, default='')


class ChangeOwnerSerializer(serializers.Serializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))


# --- Tasks and history --------------------------------------------------------


class TaskSerializer(OwnerFieldMixin, serializers.ModelSerializer):
    owner_field = 'assignee'
    assignee = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    assignee_info = UserShortSerializer(source='assignee', read_only=True)
    deal = serializers.PrimaryKeyRelatedField(queryset=Deal.objects.all(), allow_null=True, required=False)
    deal_title = serializers.CharField(source='deal.title', read_only=True, default=None)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'deal', 'deal_title', 'assignee', 'assignee_info', 'due_at',
            'is_done', 'is_overdue', 'completed_at', 'created_at',
        ]  # fmt: skip
        read_only_fields = ['is_done', 'completed_at']

    def get_is_overdue(self, obj) -> bool:
        return not obj.is_done and obj.due_at < timezone.now()

    def validate_deal(self, deal):
        if deal is not None and not visible_deals(self.context['request'].user).filter(pk=deal.pk).exists():
            raise serializers.ValidationError('Deal not found.')
        return deal


class ActivitySerializer(serializers.ModelSerializer):
    author = UserShortSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = ['id', 'kind', 'text', 'data', 'author', 'created_at']
        read_only_fields = ['kind', 'data']


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)
