"""The deal pipeline rules (services.move_deal) — the heart of the CRM."""

from django.test import TestCase

from accounts.models import User
from crm.models import Activity, Deal, Property
from crm.services import DealError, move_deal

from . import factories as f


class PipelineTests(TestCase):
    def setUp(self):
        self.manager = f.user()
        self.other_manager = f.user()
        self.head = f.user(role=User.Role.HEAD)
        self.flat = f.prop(self.manager)

    def assertCode(self, code, func, *args, **kwargs):
        with self.assertRaises(DealError) as ctx:
            func(*args, **kwargs)
        self.assertEqual(ctx.exception.code, code)

    def test_viewing_requires_a_property(self):
        deal = f.deal(self.manager)
        self.assertCode('property_required', move_deal, deal, 'viewing', self.manager)

    def test_contract_requires_an_amount(self):
        deal = f.deal(self.manager, property_obj=self.flat, amount=0)
        self.assertCode('amount_required', move_deal, deal, 'contract', self.manager)

    def test_lost_requires_a_reason(self):
        deal = f.deal(self.manager)
        self.assertCode('lost_reason_required', move_deal, deal, 'lost', self.manager, lost_reason='')

    def test_contract_reserves_the_property_and_won_sells_it(self):
        deal = f.deal(self.manager, property_obj=self.flat)
        move_deal(deal, 'contract', self.manager)
        self.flat.refresh_from_db()
        self.assertEqual(self.flat.status, Property.Status.RESERVED)

        deal = move_deal(deal, 'won', self.manager)
        self.flat.refresh_from_db()
        self.assertEqual(self.flat.status, Property.Status.SOLD)
        self.assertIsNotNone(deal.closed_at)

    def test_won_rent_deal_marks_property_rented(self):
        flat = f.prop(self.manager, deal_type='rent', price=300_000)
        deal = f.deal(self.manager, property_obj=flat, amount=300_000)
        move_deal(deal, 'won', self.manager)
        flat.refresh_from_db()
        self.assertEqual(flat.status, Property.Status.RENTED)

    def test_moving_back_from_contract_releases_the_property(self):
        deal = f.deal(self.manager, property_obj=self.flat)
        move_deal(deal, 'contract', self.manager)
        move_deal(deal, 'negotiation', self.manager)
        self.flat.refresh_from_db()
        self.assertEqual(self.flat.status, Property.Status.AVAILABLE)

    def test_losing_a_deal_under_contract_releases_the_property(self):
        deal = f.deal(self.manager, property_obj=self.flat)
        move_deal(deal, 'contract', self.manager)
        move_deal(deal, 'lost', self.manager, lost_reason='mortgage')
        self.flat.refresh_from_db()
        self.assertEqual(self.flat.status, Property.Status.AVAILABLE)

    def test_one_property_cannot_be_under_contract_twice(self):
        first = f.deal(self.manager, property_obj=self.flat)
        second = f.deal(self.other_manager, property_obj=self.flat)
        move_deal(first, 'contract', self.manager)
        self.assertCode('property_unavailable', move_deal, second, 'contract', self.other_manager)

    def test_database_constraint_catches_a_race(self):
        # Simulate a race: another deal already holds the contract, but the property status was not updated yet.
        f.deal(self.manager, property_obj=self.flat, stage='contract')
        second = f.deal(self.other_manager, property_obj=self.flat)
        self.assertCode('property_unavailable', move_deal, second, 'contract', self.other_manager)
        second.refresh_from_db()
        self.assertEqual(second.stage, 'new')  # the transaction was rolled back

    def test_manager_cannot_change_a_closed_deal_but_head_can(self):
        deal = f.deal(self.manager)
        move_deal(deal, 'lost', self.manager, lost_reason='price')
        self.assertCode('reopen_requires_head', move_deal, deal, 'contacted', self.manager)

        deal = move_deal(deal, 'contacted', self.head)
        self.assertEqual(deal.stage, 'contacted')
        self.assertIsNone(deal.closed_at)
        self.assertEqual(deal.lost_reason, '')

    def test_property_must_match_the_deal_type(self):
        rent_flat = f.prop(self.manager, deal_type='rent')
        deal = f.deal(self.manager, deal_type='sale')
        Deal.objects.filter(pk=deal.pk).update(property=rent_flat)
        deal.refresh_from_db()
        self.assertCode('property_type_mismatch', move_deal, deal, 'viewing', self.manager)

    def test_every_move_is_recorded_in_history(self):
        deal = f.deal(self.manager, property_obj=self.flat)
        move_deal(deal, 'viewing', self.manager)
        activity = Activity.objects.get(deal=deal, kind=Activity.Kind.STAGE)
        self.assertEqual(activity.data, {'from': 'new', 'to': 'viewing'})
        self.assertEqual(activity.author, self.manager)

    def test_commission(self):
        deal = f.deal(self.manager, amount=40_000_000)
        self.assertEqual(deal.commission, 1_200_000)  # 3% by default

    def test_lost_reason_must_come_from_the_list(self):
        deal = f.deal(self.manager)
        self.assertCode('lost_reason_required', move_deal, deal, 'lost', self.manager, lost_reason='too expensive')

    def test_other_reason_needs_a_comment(self):
        deal = f.deal(self.manager)
        self.assertCode('lost_comment_required', move_deal, deal, 'lost', self.manager, lost_reason='other')
        deal = move_deal(deal, 'lost', self.manager, lost_reason='other', lost_comment='Moved to another city')
        self.assertEqual((deal.lost_reason, deal.lost_comment), ('other', 'Moved to another city'))

    def test_lost_reason_code_is_kept_in_history(self):
        deal = f.deal(self.manager)
        move_deal(deal, 'lost', self.manager, lost_reason='mortgage', lost_comment='Bank refused')
        activity = Activity.objects.get(deal=deal, kind=Activity.Kind.STAGE)
        self.assertEqual(activity.data, {'from': 'new', 'to': 'lost', 'reason': 'mortgage'})
        self.assertEqual(activity.text, 'Bank refused')
