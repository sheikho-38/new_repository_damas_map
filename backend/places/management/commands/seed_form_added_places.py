import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from places.models import AdminArea, Place, SubCategory


class Command(BaseCommand):
    help = 'Seed places previously added through the form from places/data/form_added_places.json.'

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[2] / 'data' / 'form_added_places.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        created = 0

        for entry in entries:
            subcategory = SubCategory.objects.get(
                category__slug=entry['category'], slug=entry['subcategory']
            )
            area = (AdminArea.objects.get(pk=entry['admin_area_id'], name_ar=entry['admin_area_name'])
                    if entry['admin_area_id'] else None)
            _, is_new = Place.objects.update_or_create(
                title_ar=entry['title_ar'],
                defaults={
                    'title_en': entry['title_en'],
                    'description': entry['description'],
                    'sub_category': subcategory,
                    'admin_area': area,
                    'sector': entry['sector'],
                    'latitude': entry['latitude'],
                    'longitude': entry['longitude'],
                    'location_text': entry['location_text'],
                    'opening_hours': entry['opening_hours'],
                    'is_visible': entry['is_visible'],
                    'is_verified': entry['is_verified'],
                },
            )
            created += is_new

        self.stdout.write(self.style.SUCCESS(f'Processed {len(entries)} places ({created} new).'))
