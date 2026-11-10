from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand

DATA_FILE = Path(__file__).resolve().parents[2] / 'data' / 'transit_lines.js'

# عدّل هاي القيم حسب بيانات الخط الحقيقية
START_POINT = 'سومرية'
END_POINT = 'العباسيين'
PRICE = '50'
TRIP_MINUTES = 40
COLOR = '#3a6962'


class Command(BaseCommand):
    help = 'Seed the bundled transit lines (safe to run more than once).'

    def handle(self, *args, **options):
        call_command(
            'import_transit_lines',
            file=str(DATA_FILE),
            start=START_POINT,
            end=END_POINT,
            price=PRICE,
            minutes=TRIP_MINUTES,
            color=COLOR,
            align=True,
            stdout=self.stdout,
        )