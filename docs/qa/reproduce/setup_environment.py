import environment
import json
from datetime import datetime, timezone
import django

django.setup()
from django.conf import settings
from django.core.management import call_command
from accounts.models import User
from crm.models import Client, Property, Deal, Task

assert str(settings.DATABASES['default']['NAME']).startswith(str(environment.ROOT))
call_command('migrate', verbosity=0)

users = {}
for name, role in [('qa_head', 'head'), ('qa_manager_a', 'manager'), ('qa_manager_b', 'manager')]:
    user, _ = User.objects.get_or_create(username=name, defaults={'role': role, 'first_name': name})
    user.set_password('QaPortfolioOnly2026!')
    user.save()
    users[name] = user

a, b = users['qa_manager_a'], users['qa_manager_b']
ca, _ = Client.objects.get_or_create(name='QA Client Alpha', owner=a, defaults={'phone': '+77000000001', 'source': 'website'})
cb, _ = Client.objects.get_or_create(name='QA Client Bravo', owner=b, defaults={'phone': '+77000000002', 'source': 'call'})
properties = {}
for key, deal_type, agent in [('sale_a', 'sale', a), ('sale_b', 'sale', b), ('rent_a', 'rent', a)]:
    prop, _ = Property.objects.get_or_create(title='QA Property ' + key, defaults={
        'kind': 'apartment', 'deal_type': deal_type, 'district': 'esil', 'address': 'QA test address',
        'rooms': 2, 'area': '65.0', 'floor': 4, 'price': 50000000 if deal_type == 'sale' else 300000,
        'agent': agent,
    })
    properties[key] = prop

da, _ = Deal.objects.get_or_create(title='QA Deal Alpha', defaults={'client': ca, 'owner': a, 'property': properties['sale_a'], 'amount': 50000000})
db, _ = Deal.objects.get_or_create(title='QA Deal Bravo', defaults={'client': cb, 'owner': b, 'property': properties['sale_b'], 'amount': 50000000})
empty, _ = Deal.objects.get_or_create(title='QA Deal Without Property', defaults={'client': ca, 'owner': a, 'amount': 0})
ta, _ = Task.objects.get_or_create(title='QA Task Alpha', defaults={'assignee': a, 'deal': da, 'due_at': datetime(2026,11,2,4,tzinfo=timezone.utc)})

fixture = {
    'users': {k: v.pk for k,v in users.items()},
    'clients': {'a': ca.pk, 'b': cb.pk},
    'properties': {k: v.pk for k,v in properties.items()},
    'deals': {'a': da.pk, 'b': db.pk, 'empty': empty.pk},
    'tasks': {'a': ta.pk},
    'base_url': 'http://127.0.0.1:8765',
    'database': str(settings.DATABASES['default']['NAME']),
}
(environment.ROOT / 'fixture.json').write_text(json.dumps(fixture, indent=2), encoding='utf-8')
print(json.dumps(fixture, indent=2))
