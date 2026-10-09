"""
Lost reasons become a fixed list of codes instead of free text.

Old free-text reasons are converted: known phrases map to a code, everything else becomes
"other" with the original text kept in the new `lost_comment` field, so no information is lost.
The conversion runs BEFORE the column is shortened to 20 characters.
"""

from django.db import migrations, models

KNOWN = {
    'price': ['price', 'expensive', 'цена', 'дорого'],
    'other_agency': ['agency', 'агентств'],
    'mortgage': ['mortgage', 'ипотек'],
    'changed_mind': ['changed', 'передумал'],
    'found_themselves': ['own', 'сам'],
}


def text_to_code(apps, schema_editor):
    Deal = apps.get_model('crm', 'Deal')
    for deal in Deal.objects.exclude(lost_reason=''):
        text = deal.lost_reason.lower()
        code = next((code for code, words in KNOWN.items() if any(word in text for word in words)), 'other')
        deal.lost_comment = '' if code != 'other' else deal.lost_reason[:200]
        deal.lost_reason = code
        deal.save(update_fields=['lost_reason', 'lost_comment'])


class Migration(migrations.Migration):
    dependencies = [
        ('crm', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='deal',
            name='lost_comment',
            field=models.CharField(blank=True, help_text='Details, required for "Other".', max_length=200),
        ),
        migrations.RunPython(text_to_code, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='deal',
            name='lost_reason',
            field=models.CharField(
                blank=True,
                choices=[
                    ('price', 'Price too high'),
                    ('other_agency', 'Chose another agency'),
                    ('mortgage', 'Mortgage was not approved'),
                    ('changed_mind', 'Changed their mind'),
                    ('found_themselves', 'Found a property on their own'),
                    ('other', 'Other'),
                ],
                max_length=20,
            ),
        ),
    ]
