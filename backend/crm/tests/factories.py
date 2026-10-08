"""Small helpers to create test data with sensible defaults."""

from decimal import Decimal
from itertools import count

from accounts.models import User
from crm.models import Client, Deal, Property

_n = count(1)


def user(role=User.Role.MANAGER, **kwargs):
    i = next(_n)
    return User.objects.create_user(
        username=kwargs.pop('username', f'user{i}'), password='pass-12345', role=role, **kwargs
    )


def client(owner, **kwargs):
    return Client.objects.create(
        name=kwargs.pop('name', f'Client {next(_n)}'), phone='+7 700 000 00 00', owner=owner, **kwargs
    )


def prop(agent, deal_type='sale', **kwargs):
    defaults = {
        'title': f'Apartment {next(_n)}',
        'district': 'esil',
        'address': 'Astana, Turan 1',
        'area': Decimal('60'),
        'price': 40_000_000,
    }
    defaults.update(kwargs)
    return Property.objects.create(agent=agent, deal_type=deal_type, **defaults)


def deal(owner, client_obj=None, property_obj=None, **kwargs):
    defaults = {'title': f'Deal {next(_n)}', 'amount': 40_000_000}
    defaults.update(kwargs)
    return Deal.objects.create(
        owner=owner,
        client=client_obj or client(owner),
        property=property_obj,
        deal_type=property_obj.deal_type if property_obj else defaults.pop('deal_type', 'sale'),
        **defaults,
    )
