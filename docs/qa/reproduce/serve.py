import environment
import django
django.setup()
from django.core.management import call_command
call_command('runserver', '127.0.0.1:8765', use_reloader=False, insecure=True)
