import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed industry facilities with verified coordinates from places/data/industry_facilities.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'industry_facilities.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        subcategory = SubCategory.objects.get(category__slug='government', slug='central-directorates')
        created = skipped = 0

        for entry in entries:
            coordinates = entry.get('coordinates')
            if not coordinates:
                skipped += 1
                continue
            lat, lon = coordinates
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['name']}")

            details = [entry['activity'], entry['services'], entry['contact']]
            place, is_new = Place.objects.update_or_create(
                title_ar=entry['name'],
                defaults={
                    'sub_category': subcategory,
                    'latitude': lat,
                    'longitude': lon,
                    'location_text': entry['address'],
                    'description': '\n'.join(part for part in details if part),
                    'opening_hours': {'hours': entry['contact'].split('أوقات الدوام:', 1)[1].strip()}
                    if 'أوقات الدوام:' in entry['contact'] else {},
                    'sector': 'Public',
                    'is_verified': True,
                    'is_visible': True,
                },
            )
            phone = re.search(r'(?:الهواتف?|الهاتف):\s*([\d]+)', entry['contact'])
            email = re.search(r'[\w.+-]+@[\w.-]+', entry['contact'])
            website = re.search(r'الموقع:\s*([^\s\ue002]+)', entry['contact'])
            save_contact_values(
                place,
                phone=phone.group(1) if phone else '',
                email=email.group(0) if email else '',
                website=website.group(1) if website else '',
            )
            created += is_new

        self.stdout.write(self.style.SUCCESS(
            f'Processed {len(entries)} facilities: {created} new, {skipped} skipped without coordinates.'
        ))
