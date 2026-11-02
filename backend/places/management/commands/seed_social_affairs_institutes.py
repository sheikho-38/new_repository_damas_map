import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Category, Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed social affairs institutes under Education > Institutes.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'social_affairs_institutes.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        education = Category.objects.get(slug='education')
        institutes, _ = SubCategory.objects.get_or_create(
            category=education, slug='institutes',
            defaults={'name_ar': 'معاهد', 'name_en': 'Institutes'},
        )
        created = 0

        for entry in entries:
            lat, lon = entry['latitude'], entry['longitude']
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['name']}")
            details = ['طبيعة النشاط: ' + '؛ '.join(entry['activity']),
                       'الخدمات: ' + '؛ '.join(entry['services'])]
            place, is_new = Place.objects.update_or_create(
                title_ar=entry['name'],
                defaults={
                    'sub_category': institutes,
                    'latitude': lat, 'longitude': lon,
                    'description': '\n'.join(details),
                    'opening_hours': {'hours': '؛ '.join(entry['hours'])},
                    'sector': 'Public', 'is_verified': True, 'is_visible': True,
                },
            )
            save_contact_values(place, phone=' / '.join(entry['phones']), email=entry['email'])
            created += is_new

        self.stdout.write(self.style.SUCCESS(f'Processed {len(entries)} institutes ({created} new).'))
