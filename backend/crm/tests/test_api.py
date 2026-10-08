"""API permissions and endpoints: who can see and change what."""

import tempfile
from datetime import timedelta
from pathlib import Path

from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from crm.models import Activity, Deal, Task
from crm.services import move_deal

from . import factories as f


class ApiTestCase(APITestCase):
    def setUp(self):
        self.manager = f.user(first_name='Daniyar')
        self.other = f.user(first_name='Madina')
        self.head = f.user(role=User.Role.HEAD, first_name='Aliya')

    def login(self, user):
        self.client.force_authenticate(user)


class VisibilityTests(ApiTestCase):
    def test_manager_sees_only_own_deals_head_sees_all(self):
        mine = f.deal(self.manager)
        f.deal(self.other)

        self.login(self.manager)
        ids = [d['id'] for d in self.client.get('/api/deals/').data['results']]
        self.assertEqual(ids, [mine.id])

        self.login(self.head)
        self.assertEqual(self.client.get('/api/deals/').data['count'], 2)

    def test_manager_cannot_open_someone_elses_deal(self):
        foreign = f.deal(self.other)
        self.login(self.manager)
        self.assertEqual(self.client.get(f'/api/deals/{foreign.id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/deals/{foreign.id}/move/', {'stage': 'contacted'}).status_code, 404)

    def test_manager_sees_only_own_clients_and_tasks(self):
        f.client(self.other)
        Task.objects.create(title='Foreign', assignee=self.other, due_at=timezone.now())
        self.login(self.manager)
        self.assertEqual(self.client.get('/api/clients/').data['count'], 0)
        self.assertEqual(self.client.get('/api/tasks/').data['count'], 0)

    def test_property_catalog_is_shared(self):
        f.prop(self.other)
        self.login(self.manager)
        self.assertEqual(self.client.get('/api/properties/').data['count'], 1)

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.get('/api/deals/').status_code, 401)


class DealApiTests(ApiTestCase):
    def test_create_deal_defaults_owner_and_logs_history(self):
        client = f.client(self.manager)
        self.login(self.manager)
        response = self.client.post('/api/deals/', {'title': 'New', 'client': client.id, 'amount': 1000})
        self.assertEqual(response.status_code, 201, response.data)
        deal = Deal.objects.get(pk=response.data['id'])
        self.assertEqual(deal.owner, self.manager)
        self.assertTrue(Activity.objects.filter(deal=deal, kind=Activity.Kind.CREATED).exists())

    def test_manager_cannot_use_someone_elses_client(self):
        foreign_client = f.client(self.other)
        self.login(self.manager)
        response = self.client.post('/api/deals/', {'title': 'X', 'client': foreign_client.id})
        self.assertEqual(response.status_code, 400)
        self.assertIn('client', response.data)

    def test_manager_cannot_assign_deal_to_someone_else(self):
        client = f.client(self.manager)
        self.login(self.manager)
        response = self.client.post('/api/deals/', {'title': 'X', 'client': client.id, 'owner': self.other.id})
        self.assertEqual(response.status_code, 400)

    def test_head_can_reassign_and_it_is_logged(self):
        deal = f.deal(self.manager)
        self.login(self.head)
        response = self.client.post(f'/api/deals/{deal.id}/reassign/', {'owner': self.other.id})
        self.assertEqual(response.status_code, 200)
        deal.refresh_from_db()
        self.assertEqual(deal.owner, self.other)
        self.assertTrue(Activity.objects.filter(deal=deal, kind=Activity.Kind.OWNER).exists())

    def test_manager_cannot_reassign(self):
        deal = f.deal(self.manager)
        self.login(self.manager)
        response = self.client.post(f'/api/deals/{deal.id}/reassign/', {'owner': self.other.id})
        self.assertEqual(response.data['code'], 'head_only')

    def test_move_returns_error_code_for_the_frontend(self):
        deal = f.deal(self.manager)
        self.login(self.manager)
        response = self.client.post(f'/api/deals/{deal.id}/move/', {'stage': 'contract'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'property_required')

    def test_stage_cannot_be_changed_with_patch(self):
        deal = f.deal(self.manager)
        self.login(self.manager)
        self.client.patch(f'/api/deals/{deal.id}/', {'stage': 'won'})
        deal.refresh_from_db()
        self.assertEqual(deal.stage, 'new')

    def test_property_is_locked_while_under_contract(self):
        flat, other_flat = f.prop(self.manager), f.prop(self.manager)
        deal = f.deal(self.manager, property_obj=flat)
        move_deal(deal, 'contract', self.manager)
        self.login(self.manager)
        response = self.client.patch(f'/api/deals/{deal.id}/', {'property': other_flat.id})
        self.assertEqual(response.data['code'], 'property_locked')

    def test_board_groups_deals_by_stage_and_hides_old_closed_deals(self):
        f.deal(self.manager, title='Fresh')
        old = f.deal(self.manager, title='Old lost')
        move_deal(old, 'lost', self.manager, lost_reason='Price')
        Deal.objects.filter(pk=old.pk).update(closed_at=timezone.now() - timedelta(days=45))

        self.login(self.manager)
        board = self.client.get('/api/deals/board/').data
        self.assertEqual(set(board), set(Deal.Stage.values))
        self.assertEqual([d['title'] for d in board['new']], ['Fresh'])
        self.assertEqual(board['lost'], [])

    def test_notes_and_history(self):
        deal = f.deal(self.manager)
        self.login(self.manager)
        self.assertEqual(self.client.post(f'/api/deals/{deal.id}/activities/', {'text': 'Called'}).status_code, 201)
        history = self.client.get(f'/api/deals/{deal.id}/activities/').data
        self.assertEqual(history[0]['text'], 'Called')

    @override_settings(DEMO_MODE=False)
    def test_only_head_can_delete_deals(self):
        deal = f.deal(self.manager)
        self.login(self.manager)
        self.assertEqual(self.client.delete(f'/api/deals/{deal.id}/').status_code, 403)
        self.login(self.head)
        self.assertEqual(self.client.delete(f'/api/deals/{deal.id}/').status_code, 204)


class PropertyApiTests(ApiTestCase):
    def test_only_agent_or_head_can_edit_a_listing(self):
        flat = f.prop(self.other)
        self.login(self.manager)
        self.assertEqual(self.client.patch(f'/api/properties/{flat.id}/', {'price': 1}).status_code, 403)
        self.login(self.other)
        self.assertEqual(self.client.patch(f'/api/properties/{flat.id}/', {'price': 1}).status_code, 200)
        self.login(self.head)
        self.assertEqual(self.client.patch(f'/api/properties/{flat.id}/', {'price': 2}).status_code, 200)

    def test_reserved_status_cannot_be_set_by_hand(self):
        flat = f.prop(self.manager)
        self.login(self.manager)
        response = self.client.patch(f'/api/properties/{flat.id}/', {'status': 'reserved'})
        self.assertEqual(response.data['code'], 'status_managed_by_deals')

    @override_settings(DEMO_MODE=False)
    def test_property_with_deals_cannot_be_deleted(self):
        flat = f.prop(self.manager)
        f.deal(self.manager, property_obj=flat)
        self.login(self.manager)
        self.assertEqual(self.client.delete(f'/api/properties/{flat.id}/').data['code'], 'property_has_deals')

    def test_filters(self):
        f.prop(self.manager, price=10_000_000, district='nura')
        f.prop(self.manager, price=90_000_000, district='esil')
        self.login(self.manager)
        response = self.client.get('/api/properties/', {'price_max': 50_000_000, 'district': 'nura'})
        self.assertEqual(response.data['count'], 1)


class TaskApiTests(ApiTestCase):
    def test_completing_a_task_is_logged_in_the_deal(self):
        deal = f.deal(self.manager)
        task = Task.objects.create(title='Call', deal=deal, assignee=self.manager, due_at=timezone.now())
        self.login(self.manager)
        response = self.client.post(f'/api/tasks/{task.id}/complete/')
        self.assertTrue(response.data['is_done'])
        self.assertTrue(Activity.objects.filter(deal=deal, kind=Activity.Kind.TASK_DONE).exists())

    def test_when_filter(self):
        now = timezone.now()
        Task.objects.create(title='Late', assignee=self.manager, due_at=now - timedelta(days=1))
        Task.objects.create(title='Later', assignee=self.manager, due_at=now + timedelta(days=3))
        self.login(self.manager)
        overdue = self.client.get('/api/tasks/', {'when': 'overdue'}).data['results']
        self.assertEqual([t['title'] for t in overdue], ['Late'])
        self.assertTrue(overdue[0]['is_overdue'])

    def test_cannot_attach_task_to_someone_elses_deal(self):
        foreign = f.deal(self.other)
        self.login(self.manager)
        response = self.client.post(
            '/api/tasks/', {'title': 'X', 'deal': foreign.id, 'due_at': timezone.now().isoformat()}
        )
        self.assertEqual(response.status_code, 400)


class DashboardTests(ApiTestCase):
    def test_numbers(self):
        flat = f.prop(self.manager, price=50_000_000)
        won = f.deal(self.manager, property_obj=flat, amount=50_000_000)
        move_deal(won, 'won', self.manager)
        lost = f.deal(self.manager)
        move_deal(lost, 'lost', self.manager, lost_reason='Price too high')
        f.deal(self.manager, amount=20_000_000)  # still in the pipeline

        self.login(self.manager)
        data = self.client.get('/api/dashboard/').data
        self.assertEqual(data['won_this_month']['amount'], 50_000_000)
        self.assertEqual(data['won_this_month']['commission'], 1_500_000)
        self.assertEqual(data['pipeline']['amount'], 20_000_000)
        self.assertEqual(data['conversion_rate'], 50.0)
        self.assertEqual(data['lost_reasons'], [{'reason': 'Price too high', 'count': 1}])
        self.assertEqual(len(data['monthly']), 6)
        self.assertIsNone(data['leaderboard'])  # managers do not see the team ranking

    def test_head_sees_leaderboard_and_can_filter_by_manager(self):
        f.deal(self.manager, amount=1_000)
        f.deal(self.other, amount=2_000)
        self.login(self.head)
        data = self.client.get('/api/dashboard/').data
        self.assertEqual(len(data['leaderboard']), 2)
        filtered = self.client.get('/api/dashboard/', {'owner': self.manager.id}).data
        self.assertEqual(filtered['pipeline']['amount'], 1_000)

    def test_manager_cannot_peek_with_owner_filter(self):
        f.deal(self.other, amount=2_000)
        self.login(self.manager)
        data = self.client.get('/api/dashboard/', {'owner': self.other.id}).data
        self.assertEqual(data['pipeline']['amount'], 0)


class DocsTests(APITestCase):
    def test_swagger_and_schema_are_available(self):
        self.assertEqual(self.client.get('/api/docs/').status_code, 200)
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)


class AuditFixesTests(ApiTestCase):
    """Regression tests for the problems found in the pre-release audit."""

    def test_new_owner_can_edit_a_reassigned_deal(self):
        deal = f.deal(self.manager)  # the client belongs to self.manager
        self.login(self.head)
        self.client.post(f'/api/deals/{deal.id}/reassign/', {'owner': self.other.id})
        self.login(self.other)
        response = self.client.patch(f'/api/deals/{deal.id}/', {'title': 'Renamed', 'client': deal.client_id})
        self.assertEqual(response.status_code, 200, response.data)

    def test_dashboard_rejects_a_bad_owner_filter(self):
        self.login(self.head)
        response = self.client.get('/api/dashboard/', {'owner': 'abc'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_filter')

    def test_reserved_property_cannot_be_released_by_hand(self):
        flat = f.prop(self.manager)
        move_deal(f.deal(self.manager, property_obj=flat), 'contract', self.manager)
        self.login(self.manager)
        response = self.client.patch(f'/api/properties/{flat.id}/', {'status': 'available'})
        self.assertEqual(response.data['code'], 'status_managed_by_deals')

    def test_deal_type_of_a_property_in_open_deals_is_locked(self):
        flat = f.prop(self.manager)
        f.deal(self.manager, property_obj=flat)
        self.login(self.manager)
        response = self.client.patch(f'/api/properties/{flat.id}/', {'deal_type': 'rent'})
        self.assertEqual(response.data['code'], 'property_in_use')

    def test_deal_type_can_change_when_there_are_no_open_deals(self):
        flat = f.prop(self.manager)
        self.login(self.manager)
        self.assertEqual(self.client.patch(f'/api/properties/{flat.id}/', {'deal_type': 'rent'}).status_code, 200)

    @override_settings(DEMO_MODE=True)
    def test_deleting_is_disabled_in_demo_mode(self):
        deal = f.deal(self.manager)
        self.login(self.head)
        self.assertEqual(self.client.delete(f'/api/deals/{deal.id}/').data['code'], 'demo_readonly')
        self.assertEqual(self.client.delete(f'/api/clients/{deal.client_id}/').data['code'], 'demo_readonly')
        self.assertTrue(Deal.objects.filter(pk=deal.pk).exists())

    def test_health_check_is_public(self):
        response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 'ok'})

    def test_react_index_is_never_cached(self):
        with tempfile.TemporaryDirectory() as dist:
            Path(dist, 'index.html').write_text('<div id="root"></div>')
            with override_settings(FRONTEND_DIST=Path(dist)):
                response = APIClient().get('/deals/42')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Cache-Control'], 'no-cache')
                response.close()


class SeedTests(ApiTestCase):
    @override_settings(DEMO_MODE=True)
    def test_startup_recreates_demo_data(self):
        call_command('seed_demo', verbosity=0)
        f.deal(self.manager, title='Garbage')  # a visitor "breaks" the demo
        call_command('seed_demo', '--startup', verbosity=0)
        self.assertFalse(Deal.objects.filter(title='Garbage').exists())
        self.assertGreater(Deal.objects.count(), 30)

    @override_settings(DEMO_MODE=False)
    def test_startup_keeps_real_data(self):
        f.deal(self.manager, title='Real deal')
        call_command('seed_demo', '--startup', verbosity=0)
        self.assertEqual(list(Deal.objects.values_list('title', flat=True)), ['Real deal'])


class QueryCountTests(ApiTestCase):
    """Guard against N+1: the number of SQL queries must not grow with the number of rows."""

    def _count(self, url):
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        return len(ctx.captured_queries)

    def _fill(self, n):
        for _ in range(n):
            deal = f.deal(self.manager, property_obj=f.prop(self.manager))
            Task.objects.create(title='T', deal=deal, assignee=self.manager, due_at=timezone.now())

    def test_list_endpoints_do_not_grow_with_data(self):
        self.login(self.head)
        urls = ['/api/deals/', '/api/deals/board/', '/api/clients/', '/api/properties/', '/api/tasks/']
        self._fill(2)
        small = {url: self._count(url) for url in urls}
        self._fill(15)
        large = {url: self._count(url) for url in urls}
        self.assertEqual(small, large)


class TaskSummaryTests(ApiTestCase):
    def test_counts_per_tab_respect_visibility(self):
        now = timezone.now()
        Task.objects.create(title='Late', assignee=self.manager, due_at=now - timedelta(days=1))
        Task.objects.create(title='Later', assignee=self.manager, due_at=now + timedelta(days=3))
        Task.objects.create(title='Done', assignee=self.manager, due_at=now, is_done=True, completed_at=now)
        Task.objects.create(title='Foreign', assignee=self.other, due_at=now - timedelta(days=1))
        self.login(self.manager)
        data = self.client.get('/api/tasks/summary/').data
        self.assertEqual(data, {'overdue': 1, 'today': 0, 'upcoming': 1, 'done': 1})


class ClientDealsCountTests(ApiTestCase):
    def test_deals_count_includes_only_visible_deals(self):
        client = f.client(self.manager)
        f.deal(self.manager, client_obj=client)
        f.deal(self.other, client_obj=client)  # e.g. the head gave a deal of this client to a colleague
        self.login(self.manager)
        self.assertEqual(self.client.get('/api/clients/').data['results'][0]['deals_count'], 1)
        self.login(self.head)
        self.assertEqual(self.client.get('/api/clients/').data['results'][0]['deals_count'], 2)


class SpaRoutingTests(APITestCase):
    def test_missing_asset_is_404_not_the_react_page(self):
        # After a deploy an old browser tab may ask for a deleted file; HTML instead of 404 would break the page.
        with tempfile.TemporaryDirectory() as dist:
            Path(dist, 'index.html').write_text('<div id="root"></div>')
            with override_settings(FRONTEND_DIST=Path(dist)):
                self.assertEqual(APIClient().get('/assets/OldPage-abc123.js').status_code, 404)
                response = APIClient().get('/clients')
                self.assertEqual(response.status_code, 200)
                response.close()
