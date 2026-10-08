"""
Fill the database with a realistic demo agency in Astana.

Usage:
    python manage.py seed_demo             # only if the database has no deals yet
    python manage.py seed_demo --reset     # wipe CRM data and create it again
    python manage.py seed_demo --startup   # on server start: reset on the public demo, else like the first

Dates are relative to "now", so the dashboard always shows the last six months.
"""

import os
import random
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from accounts.views import DEMO_PASSWORD
from crm.models import Activity, Client, Deal, Property, Task

STAFF = [
    ('aliya', 'Aliya', 'Sadykova', User.Role.HEAD),
    ('daniyar', 'Daniyar', 'Omarov', User.Role.MANAGER),
    ('madina', 'Madina', 'Akhmetova', User.Role.MANAGER),
    ('timur', 'Timur', 'Bekov', User.Role.MANAGER),
]

STREETS = {
    'esil': ['Mangilik El', 'Turan', 'Kabanbay Batyr', 'Syganak', 'Dostyk', 'Kunayev'],
    'almaty': ['Tauelsizdik', 'Orynbor', 'Rakhymzhan Koshkarbayev', 'Shakarim'],
    'saryarka': ['Respublika', 'Beibitshilik', 'Abay', 'Seifullin'],
    'baikonyr': ['Zhenis', 'Akmeshit', 'Bogenbay Batyr'],
    'nura': ['Turkistan', 'Hussein bin Talal', 'Kerey Zhanibek khandar'],
}

PEOPLE = [
    'Aigerim Bekova', 'Nurlan Abenov', 'Dana Serikova', 'Yerlan Mukanov', 'Saule Ibraimova',
    'Askar Kassymov', 'Asel Zhumabayeva', 'Ruslan Ivanov', 'Alina Kim', 'Bauyrzhan Sapar',
    'Zhanna Omarova', 'Kairat Smagulov', 'Elena Petrova', 'Dias Akhmediyarov', 'Gulnara Tulegenova',
    'Marat Baimukhanov', 'Kamila Sultanova', 'Olzhas Nurgaliyev', 'Ainur Dzhaksybekova', 'Sergey Lee',
]  # fmt: skip
COMPANIES = [
    ('Steppe Logistics LLP', 'Arman Utepov'),
    ('Nomad Tech LLP', 'Dinara Yesenova'),
    ('Baiterek Retail Group', 'Igor Smirnov'),
    ('Altyn Coffee', 'Madi Zhunusov'),
]

LOST_REASONS = [
    'Price too high',
    'Chose another agency',
    'Mortgage was not approved',
    'Changed their mind',
    'Found a property on their own',
]

NOTES = [
    'Client prefers a high floor and a parking spot.',
    'Called back, wants to see two more options in the same district.',
    'Sent the price list and floor plans to WhatsApp.',
    'Discussed the mortgage with Otbasy Bank, waiting for approval.',
    'Owner is ready to lower the price by 3% for a quick deal.',
]


class Command(BaseCommand):
    help = 'Create a demo real estate agency: staff, properties, clients, deals, tasks and history.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing CRM data first.')
        parser.add_argument(
            '--startup',
            action='store_true',
            help='Used when the server starts: on the public demo (DJANGO_DEMO_MODE=1) recreate the data, '
            'otherwise only create it if the database is empty.',
        )

    def handle(self, *args, **options):
        if options['startup'] and settings.DEMO_MODE:
            options['reset'] = True
        if options['reset']:
            Deal.objects.all().delete()  # tasks and activities are deleted by cascade
            Task.objects.all().delete()
            Client.objects.all().delete()
            Property.objects.all().delete()
        elif Deal.objects.exists():
            self.stdout.write('Demo data already exists, skipping. Use --reset to recreate it.')
            self._ensure_admin()
            return

        self.rng = random.Random(2026)  # fixed seed: the same demo every time
        self.now = timezone.now()
        with transaction.atomic():
            staff = self._staff()
            managers = [user for user in staff if user.role == User.Role.MANAGER]
            properties = self._properties(managers)
            clients = self._clients(managers)
            self._deals(managers, staff[0], clients, properties)
        self._ensure_admin()
        self.stdout.write(
            self.style.SUCCESS(
                f'Demo agency ready: {Property.objects.count()} properties, {Client.objects.count()} clients, '
                f'{Deal.objects.count()} deals, {Task.objects.count()} tasks. '
                f'Logins: aliya (head), daniyar / madina / timur (managers), password "{DEMO_PASSWORD}".'
            )
        )

    # --- helpers ----------------------------------------------------------------

    def _ensure_admin(self):
        # The admin password is never public: it comes from an environment variable on a live server.
        password = os.environ.get('DJANGO_ADMIN_PASSWORD') or (DEMO_PASSWORD if settings.DEBUG else None)
        if password and not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@example.com', password, role=User.Role.HEAD)

    def _staff(self):
        users = []
        for username, first, last, role in STAFF:
            user, created = User.objects.get_or_create(
                username=username, defaults={'first_name': first, 'last_name': last, 'role': role}
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            users.append(user)
        return users

    def _properties(self, managers):
        rng = self.rng
        result = []
        plan = [('apartment', 'sale')] * 12 + [('apartment', 'rent')] * 8 + [('house', 'sale')] * 3
        plan += [('house', 'rent')] * 1 + [('commercial', 'sale')] * 2 + [('commercial', 'rent')] * 3
        plan += [('land', 'sale')] * 2
        for kind, deal_type in plan:
            district = rng.choice(list(STREETS))
            street = rng.choice(STREETS[district])
            number = rng.randint(1, 60)
            rooms, area, floor = None, None, None
            if kind == 'apartment':
                rooms = rng.choice([1, 1, 2, 2, 2, 3, 3, 4])
                area = rooms * rng.randint(22, 32) + rng.randint(5, 20)
                floor = rng.randint(2, 18)
                price = area * rng.randint(520_000, 780_000) if deal_type == 'sale' else rng.randint(18, 60) * 10_000
                title = f'{rooms}-room apartment, {street} {number}'
            elif kind == 'house':
                rooms = rng.randint(4, 7)
                area = rng.randint(140, 320)
                price = rng.randint(60, 190) * 1_000_000 if deal_type == 'sale' else rng.randint(50, 120) * 10_000
                title = f'House {area} m², {street} {number}'
            elif kind == 'commercial':
                area = rng.randint(40, 400)
                floor = 1
                price = area * rng.randint(450_000, 900_000) if deal_type == 'sale' else area * rng.randint(4, 9) * 1000
                title = f'Commercial space {area} m², {street} {number}'
            else:
                area = rng.randint(6, 15) * 100
                price = rng.randint(15, 60) * 1_000_000
                title = f'Land plot {area // 100} sotka, {district.title()} district'
            result.append(
                Property.objects.create(
                    title=title, kind=kind, deal_type=deal_type, district=district,
                    address=f'Astana, {street} {number}', rooms=rooms, area=Decimal(area), floor=floor,
                    price=round(price, -4), agent=rng.choice(managers),
                    description='Good condition, documents are ready for the deal.',
                )
            )  # fmt: skip
        return result

    def _clients(self, managers):
        rng = self.rng
        clients = []
        for name in PEOPLE:
            phone = f'+7 70{rng.randint(1, 8)} {rng.randint(100, 999)} {rng.randint(10, 99)} {rng.randint(10, 99)}'
            clients.append(
                Client.objects.create(
                    name=name, kind=Client.Kind.PERSON, phone=phone,
                    email=f'{name.split()[0].lower()}.{name.split()[1].lower()}@mail.kz',
                    source=rng.choice(Client.Source.values), owner=rng.choice(managers),
                )
            )  # fmt: skip
        for company, contact in COMPANIES:
            clients.append(
                Client.objects.create(
                    name=contact, kind=Client.Kind.COMPANY, company_name=company,
                    phone=f'+7 717 2{rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}',
                    source=rng.choice([Client.Source.REFERRAL, Client.Source.CALL]), owner=rng.choice(managers),
                )
            )  # fmt: skip
        return clients

    def _deal(self, *, client, prop, owner, stage, days_ago, close_days_ago=None, lost_reason=''):
        deal_type = prop.deal_type if prop else 'sale'
        amount = prop.price if prop else 0
        if prop and stage in (Deal.Stage.NEGOTIATION, Deal.Stage.CONTRACT, Deal.Stage.WON) and deal_type == 'sale':
            amount = round(prop.price * self.rng.uniform(0.95, 1.0), -4)  # a small discount after negotiation
        title = (
            f'{client.name.split()[0]} — {prop.title.split(",")[0].lower()}' if prop else f'{client.name} — new request'
        )
        deal = Deal.objects.create(
            title=title, client=client, property=prop, deal_type=deal_type, stage=stage, amount=amount,
            commission_percent=Decimal('3.00') if deal_type == 'sale' else Decimal('50.00'),
            owner=owner, lost_reason=lost_reason,
            expected_close_date=(self.now + timedelta(days=self.rng.randint(5, 40))).date()
            if stage not in Deal.CLOSED_STAGES else None,
        )  # fmt: skip
        created = self.now - timedelta(days=days_ago, hours=self.rng.randint(0, 8))
        closed = (
            self.now - timedelta(days=close_days_ago, hours=self.rng.randint(0, 8))
            if close_days_ago is not None
            else None
        )
        Deal.objects.filter(pk=deal.pk).update(created_at=created, updated_at=closed or created, closed_at=closed)

        # History with realistic timestamps: from the creation date up to the close date (or now).
        order = Deal.Stage.values
        path = (
            order[: order.index(stage) + 1] if stage != Deal.Stage.LOST else order[: self.rng.randint(1, 4)] + ['lost']
        )
        end = closed or self.now - timedelta(hours=self.rng.randint(1, 20))
        events = [(Activity.Kind.CREATED, {}, '')]
        events += [
            (Activity.Kind.STAGE, {'from': prev, 'to': cur}, lost_reason if cur == 'lost' else '')
            for prev, cur in zip(path, path[1:], strict=False)
        ]
        if self.rng.random() < 0.6:
            events.insert(self.rng.randint(1, len(events)), (Activity.Kind.NOTE, {}, self.rng.choice(NOTES)))
        step = (end - created) / max(len(events) - 1, 1)
        for index, (kind, data, text) in enumerate(events):
            activity = Activity.objects.create(deal=deal, author=owner, kind=kind, data=data, text=text)
            Activity.objects.filter(pk=activity.pk).update(created_at=created + step * index)

        if prop and stage == Deal.Stage.CONTRACT:
            prop.status = Property.Status.RESERVED
            prop.save(update_fields=['status'])
        elif prop and stage == Deal.Stage.WON:
            prop.status = Property.Status.SOLD if deal_type == 'sale' else Property.Status.RENTED
            prop.save(update_fields=['status'])
        return deal

    def _deals(self, managers, head, clients, properties):
        rng = self.rng
        free = properties[:]
        rng.shuffle(free)
        clients = clients[:]
        rng.shuffle(clients)

        def take_property():
            return free.pop()

        def client():
            return rng.choice(clients)

        # Closed won: spread over the last six months, so the dashboard chart has history.
        for i in range(11):
            close = 1 + i * 15 + rng.randint(0, 4)  # the first ones close this month
            self._deal(client=client(), prop=take_property(), owner=managers[i % 3], stage=Deal.Stage.WON,
                       days_ago=close + rng.randint(10, 35), close_days_ago=close)  # fmt: skip
        # Lost deals.
        for i in range(6):
            close = 5 + i * 14
            self._deal(client=client(), prop=rng.choice(properties), owner=managers[(i + 1) % 3],
                       stage=Deal.Stage.LOST, days_ago=close + rng.randint(7, 25), close_days_ago=close,
                       lost_reason=rng.choice(LOST_REASONS))  # fmt: skip
        # Active pipeline.
        active_plan = [Deal.Stage.NEW] * 4 + [Deal.Stage.CONTACTED] * 4 + [Deal.Stage.VIEWING] * 5
        active_plan += [Deal.Stage.NEGOTIATION] * 4 + [Deal.Stage.CONTRACT] * 3
        active = []
        for i, stage in enumerate(active_plan):
            prop = None if stage in (Deal.Stage.NEW, Deal.Stage.CONTACTED) and rng.random() < 0.6 else take_property()
            active.append(
                self._deal(client=client(), prop=prop, owner=managers[i % 3], stage=stage, days_ago=rng.randint(1, 30))
            )

        # Tasks: some overdue, some for today, some later, some done.
        templates = {
            Deal.Stage.NEW: 'Call the client and qualify the request',
            Deal.Stage.CONTACTED: 'Pick 3 options and send them to the client',
            Deal.Stage.VIEWING: 'Show the property',
            Deal.Stage.NEGOTIATION: 'Agree on the final price with the owner',
            Deal.Stage.CONTRACT: 'Prepare documents for the notary',
        }
        offsets = [-2, -1, 0, 0, 1, 2, 3, 5]
        for deal in active:
            due = self.now + timedelta(days=rng.choice(offsets), hours=rng.randint(1, 6))
            Task.objects.create(title=templates[deal.stage], deal=deal, assignee=deal.owner, due_at=due)
            if rng.random() < 0.4:
                done_at = self.now - timedelta(days=rng.randint(1, 5))
                Task.objects.create(
                    title='Send the first selection of properties', deal=deal, assignee=deal.owner,
                    due_at=done_at, is_done=True, completed_at=done_at,
                )  # fmt: skip
        for manager in managers:
            Task.objects.create(title='Update listing photos on Krisha.kz', assignee=manager,
                                due_at=self.now + timedelta(days=rng.randint(1, 4)))  # fmt: skip
        Task.objects.create(title='Weekly pipeline review with the team', assignee=head,
                            due_at=self.now + timedelta(days=2))  # fmt: skip
