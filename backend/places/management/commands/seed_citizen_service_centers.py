import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed citizen service centers from places/data/citizen_service_centers.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'citizen_service_centers.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        subcategory = SubCategory.objects.get(
            category__slug='damascus-governorate', slug='citizen-service-centers'
        )
        created = 0

        for entry in entries:
            lat, lon = entry['latitude'], entry['longitude']
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['name']}")
            address = entry['address']
            if entry['plus_code']:
                address += f" - {entry['plus_code']}"
            _, is_new = Place.objects.update_or_create(
                title_ar=f"مركز خدمة المواطن - {entry['name']}",
                sub_category=subcategory,
                defaults={
                    'latitude': lat,
                    'longitude': lon,
                    'location_text': address,
                    'description': entry['services'],
                    'sector': '',
                    'is_verified': True,
                    'is_visible': True,
                },
            )
            created += is_new

        self.stdout.write(self.style.SUCCESS(f'Processed {len(entries)} centers ({created} new).'))
