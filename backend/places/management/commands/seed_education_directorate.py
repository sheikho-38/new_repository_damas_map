import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed Damascus education directorate facilities from places/data/education_directorate.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'education_directorate.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        subcategory = SubCategory.objects.get(category__slug='government', slug='central-directorates')
        created = 0

        for entry in entries:
            lat, lon = entry['coordinates']
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['name']}")
            place, is_new = Place.objects.update_or_create(
                title_ar=entry['name'],
                defaults={
                    'sub_category': subcategory,
                    'latitude': lat,
                    'longitude': lon,
                    'description': f"{entry['services']}\nرابط الموقع: {entry['map_url']}",
                    'sector': '',
                    'is_verified': True,
                    'is_visible': True,
                },
            )
            save_contact_values(place, phone=entry['contact'])
            created += is_new

        self.stdout.write(self.style.SUCCESS(f'Processed {len(entries)} facilities ({created} new).'))
