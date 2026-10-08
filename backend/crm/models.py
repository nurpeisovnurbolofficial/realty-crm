import builtins
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class DealType(models.TextChoices):
    SALE = 'sale', 'Sale'
    RENT = 'rent', 'Rent'


class Client(models.Model):
    """A person or a company the agency works with: buyer, seller, tenant or landlord."""

    class Kind(models.TextChoices):
        PERSON = 'person', 'Person'
        COMPANY = 'company', 'Company'

    class Source(models.TextChoices):
        WEBSITE = 'website', 'Website'
        KRISHA = 'krisha', 'Krisha.kz'
        REFERRAL = 'referral', 'Referral'
        CALL = 'call', 'Phone call'
        SOCIAL = 'social', 'Social media'
        OTHER = 'other', 'Other'

    name = models.CharField(max_length=150)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.PERSON)
    company_name = models.CharField(max_length=150, blank=True, help_text='For a contact person of a company.')
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.OTHER)
    notes = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='clients', help_text='Responsible manager.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Property(models.Model):
    """A listing: an apartment, house, office or land plot for sale or rent."""

    class Kind(models.TextChoices):
        APARTMENT = 'apartment', 'Apartment'
        HOUSE = 'house', 'House'
        COMMERCIAL = 'commercial', 'Commercial'
        LAND = 'land', 'Land'

    class District(models.TextChoices):
        ESIL = 'esil', 'Esil'
        ALMATY = 'almaty', 'Almaty'
        SARYARKA = 'saryarka', 'Saryarka'
        BAIKONYR = 'baikonyr', 'Baikonyr'
        NURA = 'nura', 'Nura'

    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Available'
        RESERVED = 'reserved', 'Reserved'  # a deal reached the contract stage
        SOLD = 'sold', 'Sold'
        RENTED = 'rented', 'Rented'

    title = models.CharField(max_length=150)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.APARTMENT)
    deal_type = models.CharField(max_length=4, choices=DealType.choices, default=DealType.SALE)
    district = models.CharField(max_length=10, choices=District.choices)
    address = models.CharField(max_length=200)
    rooms = models.PositiveSmallIntegerField(null=True, blank=True)
    area = models.DecimalField(max_digits=8, decimal_places=1, validators=[MinValueValidator(Decimal('1'))])
    floor = models.SmallIntegerField(null=True, blank=True)
    price = models.PositiveBigIntegerField(help_text='KZT. For rent: price per month.')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.AVAILABLE)
    description = models.TextField(blank=True)
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='properties')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'properties'

    def __str__(self):
        return self.title


class Deal(models.Model):
    """A sale or rent deal moving through the pipeline (the Kanban board)."""

    class Stage(models.TextChoices):
        NEW = 'new', 'New lead'
        CONTACTED = 'contacted', 'Contacted'
        VIEWING = 'viewing', 'Viewing'
        NEGOTIATION = 'negotiation', 'Negotiation'
        CONTRACT = 'contract', 'Contract'
        WON = 'won', 'Closed won'
        LOST = 'lost', 'Lost'

    CLOSED_STAGES = (Stage.WON, Stage.LOST)

    title = models.CharField(max_length=150)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='deals')
    property = models.ForeignKey(Property, on_delete=models.PROTECT, null=True, blank=True, related_name='deals')
    deal_type = models.CharField(max_length=4, choices=DealType.choices, default=DealType.SALE)
    stage = models.CharField(max_length=12, choices=Stage.choices, default=Stage.NEW, db_index=True)
    amount = models.PositiveBigIntegerField(default=0, help_text='Deal value in KZT.')
    commission_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('3.00'),
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='deals')
    lost_reason = models.CharField(max_length=200, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['owner', 'stage'])]
        constraints = [
            # Database-level safety net: a property can be under contract in only one deal at a time.
            # ('won' is not included: a rental property can be rented again later, by a new deal.)
            models.UniqueConstraint(
                fields=['property'],
                condition=models.Q(stage='contract'),
                name='one_contract_per_property',
            ),
        ]

    def __str__(self):
        return self.title

    # `property` is a field name in this class, so the built-in decorator is referenced explicitly.
    @builtins.property
    def commission(self):
        """Agency income from this deal, in KZT."""
        return int(self.amount * self.commission_percent / 100)

    @builtins.property
    def is_closed(self):
        return self.stage in self.CLOSED_STAGES


class Task(models.Model):
    """A to-do for a manager, e.g. "Show the apartment on Saturday at 15:00"."""

    title = models.CharField(max_length=200)
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tasks')
    due_at = models.DateTimeField()
    is_done = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['is_done', 'due_at']

    def __str__(self):
        return self.title


class Activity(models.Model):
    """Deal history: notes written by people and events recorded automatically."""

    class Kind(models.TextChoices):
        NOTE = 'note', 'Note'
        CREATED = 'created', 'Deal created'
        STAGE = 'stage', 'Stage changed'
        OWNER = 'owner', 'Owner changed'
        TASK_DONE = 'task_done', 'Task completed'

    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='activities')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    kind = models.CharField(max_length=10, choices=Kind.choices)
    text = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True, help_text='Event details, e.g. {"from": "new", "to": "viewing"}.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'activities'

    def __str__(self):
        return f'{self.get_kind_display()} · {self.deal}'
