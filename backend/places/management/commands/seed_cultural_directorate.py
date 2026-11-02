import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.contacts import save_contact_values
from places.models import Category, Place, SubCategory, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class Command(BaseCommand):
    help = 'Seed facilities from the Damascus culture directorate report.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'cultural_directorate.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        directorate = SubCategory.objects.get(
            category__slug='government', slug='central-directorates'
        )
        culture = Category.objects.get(slug='culture')
        labels = {
            'cultural-center': 'مراكز ثقافية',
            'training-institute': 'معاهد الثقافة الشعبية',
            'applied-arts': 'فنون تطبيقية',
            'music-institute': 'معاهد موسيقية',
        }
        categories = {
            slug: SubCategory.objects.get_or_create(
                category=culture, slug=slug, defaults={'name_ar': label}
            )[0] for slug, label in labels.items()
        }
        created = skipped = 0

        for entry in data['facilities']:
            lat, lon = entry['latitude'], entry['longitude']
            if lat is None or lon is None:
                skipped += 1
                continue
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                raise ValueError(f"Coordinates outside Damascus bounds: {entry['title']}")
            description = [entry.get('services', ''), entry.get('notes', ''),
                           f"المصدر: {data['source']} — الصفحة {entry['page']}."]
            place, is_new = Place.objects.update_or_create(
                title_ar=entry['title'],
                defaults={
                    'sub_category': directorate if entry['subcategory'] == 'directorate'
                    else categories[entry['subcategory']],
                    'latitude': lat, 'longitude': lon,
                    'location_text': entry.get('address', ''),
                    'opening_hours': {'hours': entry['hours']} if entry.get('hours') else {},
                    'description': '\n'.join(part for part in description if part),
                    'sector': 'Public', 'is_visible': True, 'is_verified': True,
                },
            )
            save_contact_values(place, phone=entry.get('phones', ''), email=entry.get('email', ''))
            created += is_new

        self.stdout.write(self.style.SUCCESS(
            f'Processed {len(data["facilities"])} facilities ({created} new, {skipped} without coordinates).'
        ))
