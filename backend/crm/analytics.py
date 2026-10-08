"""Numbers for the dashboard. Every query is scoped to the deals the user may see."""

from datetime import timedelta

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from accounts.models import User

from .models import Deal

COMMISSION = ExpressionWrapper(
    F('amount') * F('commission_percent') / 100, output_field=DecimalField(max_digits=20, decimal_places=2)
)


def _month_start(dt, months_back=0):
    month = dt.month - months_back
    year = dt.year
    while month <= 0:
        month += 12
        year -= 1
    return dt.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)


def dashboard(deals, tasks):
    """`deals` and `tasks` are already filtered by visibility (and by the owner filter, if any)."""
    now = timezone.localtime()
    month_start = _month_start(now)
    period_start = now - timedelta(days=90)

    active = deals.exclude(stage__in=Deal.CLOSED_STAGES)
    won = deals.filter(stage=Deal.Stage.WON)
    won_month = won.filter(closed_at__gte=month_start).aggregate(
        count=Count('id'), total=Sum('amount'), commission=Sum(COMMISSION)
    )
    pipeline = active.aggregate(count=Count('id'), total=Sum('amount'), commission=Sum(COMMISSION))

    closed_recent = deals.filter(stage__in=Deal.CLOSED_STAGES, closed_at__gte=period_start)
    won_recent = closed_recent.filter(stage=Deal.Stage.WON)
    closed_count = closed_recent.count()
    won_count = won_recent.count()
    durations = [(closed - created).days for closed, created in won_recent.values_list('closed_at', 'created_at')]

    by_stage = {row['stage']: row for row in active.values('stage').annotate(count=Count('id'), total=Sum('amount'))}
    stages = [
        {
            'stage': stage,
            'count': by_stage.get(stage, {}).get('count', 0),
            'amount': by_stage.get(stage, {}).get('total') or 0,
        }
        for stage in Deal.Stage.values
        if stage not in Deal.CLOSED_STAGES
    ]

    six_months_ago = _month_start(now, months_back=5)
    monthly_rows = (
        won.filter(closed_at__gte=six_months_ago)
        .annotate(month=TruncMonth('closed_at'))
        .values('month')
        .annotate(count=Count('id'), total=Sum('amount'), commission=Sum(COMMISSION))
    )
    monthly_map = {row['month'].strftime('%Y-%m'): row for row in monthly_rows}
    monthly = []
    for back in range(5, -1, -1):
        key = _month_start(now, months_back=back).strftime('%Y-%m')
        row = monthly_map.get(key, {})
        monthly.append(
            {'month': key, 'won_count': row.get('count', 0), 'amount': row.get('total') or 0,
             'commission': int(row.get('commission') or 0)}
        )  # fmt: skip

    lost_reasons = list(
        deals.filter(stage=Deal.Stage.LOST, closed_at__gte=period_start)
        .exclude(lost_reason='')
        .values('lost_reason')
        .annotate(count=Count('id'))
        .order_by('-count')[:5]
    )

    open_tasks = tasks.filter(is_done=False)
    today_end = now.replace(hour=23, minute=59, second=59)

    return {
        'pipeline': {
            'count': pipeline['count'],
            'amount': pipeline['total'] or 0,
            'commission': int(pipeline['commission'] or 0),
        },
        'won_this_month': {
            'count': won_month['count'],
            'amount': won_month['total'] or 0,
            'commission': int(won_month['commission'] or 0),
        },
        'conversion_rate': round(won_count / closed_count * 100, 1) if closed_count else None,
        'avg_days_to_close': round(sum(durations) / len(durations), 1) if durations else None,
        'by_stage': stages,
        'monthly': monthly,
        'lost_reasons': [{'reason': r['lost_reason'], 'count': r['count']} for r in lost_reasons],
        'tasks': {
            'overdue': open_tasks.filter(due_at__lt=now).count(),
            'today': open_tasks.filter(due_at__gte=now, due_at__lte=today_end).count(),
        },
    }


def leaderboard(deals):
    """Managers ranked by commission over the last 90 days. Only the head sees this."""
    period_start = timezone.now() - timedelta(days=90)
    won_recent = Q(deals__stage=Deal.Stage.WON, deals__closed_at__gte=period_start, deals__in=deals)
    active = Q(deals__in=deals.exclude(stage__in=Deal.CLOSED_STAGES))
    rows = (
        User.objects.filter(is_active=True, role=User.Role.MANAGER)
        .annotate(
            won_count=Count('deals', filter=won_recent, distinct=True),
            won_amount=Sum('deals__amount', filter=won_recent),
            commission=Sum(
                ExpressionWrapper(
                    F('deals__amount') * F('deals__commission_percent') / 100,
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
                filter=won_recent,
            ),
            active_deals=Count('deals', filter=active, distinct=True),
        )
        .order_by(F('commission').desc(nulls_last=True), 'first_name')
    )
    return [
        {
            'id': user.id,
            'name': user.display_name,
            'won_count': user.won_count,
            'won_amount': user.won_amount or 0,
            'commission': int(user.commission or 0),
            'active_deals': user.active_deals,
        }
        for user in rows
    ]
