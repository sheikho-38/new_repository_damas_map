import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed proposed rubble dump sites from places/data/rubble_dump_sites.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'rubble_dump_sites.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        subcategory = SubCategory.objects.get(category__slug='public-facilities', slug='rubble-dumps')
        created = 0

        for entry in entries:
            lat, lon = entry['latitude'], entry['longitude']
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside allowed bounds: {entry['name']}")
            _, is_new = Place.objects.update_or_create(
                title_ar=f"مكب أنقاض - {entry['name']}",
                sub_category=subcategory,
                defaults={
                    'latitude': lat, 'longitude': lon,
                    'location_text': entry['name'],
                    'description': 'موقع مقترح لتخصيصه مكباً للأنقاض والردم وفق كتاب محافظة دمشق لعام 2026.',
                    'sector': '', 'is_verified': True, 'is_visible': True,
                },
            )
            created += is_new

        self.stdout.write(self.style.SUCCESS(f'Processed {len(entries)} sites ({created} new).'))
