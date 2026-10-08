"""
Business rules of the CRM, kept separate from API views so they are easy to test
and are applied the same way from every entry point.

Key rules:
- who sees what: a manager works with their own clients, deals and tasks; the head sees everything;
- how a deal moves through the pipeline (move_deal);
- one property cannot be under contract in two deals at the same time.
"""

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Activity, Client, Deal, Property, Task


class DealError(Exception):
    """A business rule was broken. `code` is stable for the frontend, `message` is English for the API docs."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def check_delete_allowed(user):
    """On the public demo nobody (except a superuser) can delete data, so the next visitor sees a full CRM."""
    if settings.DEMO_MODE and not user.is_superuser:
        raise DealError('demo_readonly', 'Deleting is disabled in the public demo.')


# --- Visibility ---------------------------------------------------------------


def visible_clients(user):
    qs = Client.objects.select_related('owner')
    return qs if user.is_head else qs.filter(owner=user)


def visible_deals(user):
    qs = Deal.objects.select_related('client', 'property', 'owner')
    return qs if user.is_head else qs.filter(owner=user)


def visible_tasks(user):
    qs = Task.objects.select_related('deal', 'assignee')
    return qs if user.is_head else qs.filter(assignee=user)


def can_edit_property(user, prop):
    """The property catalog is shared, but only its agent or the head can change a listing."""
    return user.is_head or prop.agent_id == user.id


# --- Deal pipeline ------------------------------------------------------------

STAGES_NEEDING_PROPERTY = {Deal.Stage.VIEWING, Deal.Stage.NEGOTIATION, Deal.Stage.CONTRACT, Deal.Stage.WON}
STAGES_HOLDING_PROPERTY = {Deal.Stage.CONTRACT, Deal.Stage.WON}  # the property is taken by this deal


def _log(deal, user, kind, text='', **data):
    return Activity.objects.create(deal=deal, author=user, kind=kind, text=text, data=data)


def check_property_matches(deal_type, prop):
    if prop is not None and prop.deal_type != deal_type:
        raise DealError('property_type_mismatch', 'The property is listed for a different deal type (sale/rent).')


def create_deal(user, **fields):
    deal = Deal.objects.create(**fields)
    _log(deal, user, Activity.Kind.CREATED)
    return deal


def move_deal(deal, new_stage, user, lost_reason=''):
    """
    Move a deal to another stage of the pipeline, keeping the property status in sync.

    Runs in a transaction with row locks: if two managers try to put the same property
    under contract at the same moment, the second one waits and then gets a clear error.
    """
    if new_stage not in Deal.Stage.values:
        raise DealError('invalid_stage', 'Unknown stage.')

    try:
        with transaction.atomic():
            deal = Deal.objects.select_for_update().get(pk=deal.pk)
            old_stage = deal.stage
            if old_stage == new_stage:
                return deal

            if deal.is_closed and not user.is_head:
                raise DealError('reopen_requires_head', 'Only the head of sales can change a closed deal.')

            prop = Property.objects.select_for_update().get(pk=deal.property_id) if deal.property_id else None

            if new_stage in STAGES_NEEDING_PROPERTY and prop is None:
                raise DealError('property_required', 'Attach a property before moving the deal to this stage.')
            if new_stage in STAGES_HOLDING_PROPERTY and deal.amount <= 0:
                raise DealError('amount_required', 'Set the deal amount before the contract stage.')
            if new_stage == Deal.Stage.LOST and not lost_reason.strip():
                raise DealError('lost_reason_required', 'Tell why the deal was lost.')
            check_property_matches(deal.deal_type, prop)

            held_before = old_stage in STAGES_HOLDING_PROPERTY
            holds_now = new_stage in STAGES_HOLDING_PROPERTY

            if holds_now and not held_before:
                if prop.status != Property.Status.AVAILABLE:
                    raise DealError('property_unavailable', 'This property is already reserved, sold or rented.')

            if prop is not None:
                if new_stage == Deal.Stage.WON:
                    prop.status = Property.Status.SOLD if deal.deal_type == 'sale' else Property.Status.RENTED
                elif new_stage == Deal.Stage.CONTRACT:
                    prop.status = Property.Status.RESERVED
                elif held_before:
                    prop.status = Property.Status.AVAILABLE  # the deal let the property go
                prop.save(update_fields=['status'])

            deal.stage = new_stage
            if new_stage in Deal.CLOSED_STAGES:
                deal.closed_at = timezone.now()
                deal.lost_reason = lost_reason.strip() if new_stage == Deal.Stage.LOST else ''
            else:
                deal.closed_at = None
                deal.lost_reason = ''
            deal.save()
    except IntegrityError:
        # The database constraint caught a race: another deal took this property a moment ago.
        raise DealError('property_unavailable', 'This property is already reserved, sold or rented.') from None

    _log(deal, user, Activity.Kind.STAGE, text=deal.lost_reason, **{'from': old_stage, 'to': new_stage})
    return deal


def change_owner(deal, new_owner, user):
    if not user.is_head:
        raise DealError('head_only', 'Only the head of sales can reassign deals.')
    if deal.owner_id == new_owner.id:
        return deal
    old_owner = deal.owner
    deal.owner = new_owner
    deal.save(update_fields=['owner', 'updated_at'])
    _log(deal, user, Activity.Kind.OWNER, **{'from': old_owner.display_name, 'to': new_owner.display_name})
    return deal


def add_note(deal, user, text):
    if not text.strip():
        raise DealError('empty_note', 'The note is empty.')
    return _log(deal, user, Activity.Kind.NOTE, text=text.strip())


def set_task_done(task, user, done=True):
    task.is_done = done
    task.completed_at = timezone.now() if done else None
    task.save(update_fields=['is_done', 'completed_at'])
    if done and task.deal_id:
        _log(task.deal, user, Activity.Kind.TASK_DONE, text=task.title)
    return task
