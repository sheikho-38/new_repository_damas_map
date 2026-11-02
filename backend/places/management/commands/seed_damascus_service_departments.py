import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed Damascus service departments from places/data/damascus_service_departments.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'damascus_service_departments.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        subcategory = SubCategory.objects.get(
            category__slug='damascus-governorate', slug='municipality-buildings'
        )
        created = skipped = 0

        for entry in entries:
            if not entry['coordinates']:
                skipped += 1
                continue
            lat, lon = entry['coordinates']
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['name']}")
            place, is_new = Place.objects.update_or_create(
                title_ar=f"دائرة خدمات {entry['name']}",
                sub_category=subcategory,
                defaults={
                    'latitude': lat, 'longitude': lon,
                    'location_text': f"{entry['address']} - {entry['plus_code']}",
                    'sector': 'Public', 'is_verified': True, 'is_visible': True,
                },
            )
            save_contact_values(place, mobile=entry['mobile'])
            created += is_new

        self.stdout.write(self.style.SUCCESS(
            f'Processed {len(entries)} departments ({created} new, {skipped} without coordinates).'
        ))
