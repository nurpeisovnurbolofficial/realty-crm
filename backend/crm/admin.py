from django.contrib import admin

from .models import Activity, Client, Deal, Property, Task


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'kind', 'phone', 'source', 'owner', 'created_at']
    list_filter = ['kind', 'source', 'owner']
    search_fields = ['name', 'phone', 'email']


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ['title', 'kind', 'deal_type', 'district', 'price', 'status', 'agent']
    list_filter = ['kind', 'deal_type', 'district', 'status']
    search_fields = ['title', 'address']


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ['title', 'client', 'stage', 'deal_type', 'amount', 'owner', 'updated_at']
    list_filter = ['stage', 'deal_type', 'owner']
    search_fields = ['title', 'client__name']
    # The stage is read-only here: it must go through services.move_deal to keep property statuses correct.
    readonly_fields = ['stage', 'closed_at', 'lost_reason']
    inlines = [TaskInline]


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'assignee', 'due_at', 'is_done']
    list_filter = ['is_done', 'assignee']


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ['deal', 'kind', 'author', 'created_at']
    list_filter = ['kind']
