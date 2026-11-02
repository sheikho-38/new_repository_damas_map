import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed located health facilities from places/data/health_facilities_2026.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'health_facilities_2026.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        slugs = {'مركز': 'health-centers', 'مستشفى': 'hospitals', 'بنك دم': 'blood-banks'}
        categories = {
            kind: SubCategory.objects.get(category__slug='healthcare', slug=slug)
            for kind, slug in slugs.items()
        }
        created = missing = outside = 0

        for entry in entries:
            if entry['type'] not in categories:
                raise ValueError(f"Unknown facility type at row {entry['source_row']}")
            lat, lon = entry['latitude'], entry['longitude']
            if lat is None or lon is None:
                missing += 1
                continue
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                outside += 1
                continue
            ownership = entry['ownership']
            description = entry['ministry']
            if ownership.startswith('منظمة'):
                description = '\n'.join(part for part in (description, f'الملكية: {ownership}') if part)
            place, is_new = Place.objects.update_or_create(
                title_ar=entry['name'],
                defaults={
                    'sub_category': categories[entry['type']],
                    'latitude': lat, 'longitude': lon,
                    'description': description,
                    'opening_hours': {'hours': entry['operational_status']}
                    if entry['operational_status'] else {},
                    'sector': {'حكومي': 'Public', 'خاص': 'private'}.get(ownership, ''),
                },
            )
            save_contact_values(place, phone=entry['phone'])
            created += is_new

        self.stdout.write(self.style.SUCCESS(
            f'Processed {len(entries)} facilities ({created} new, '
            f'{missing} without coordinates, {outside} outside bounds).'
        ))
