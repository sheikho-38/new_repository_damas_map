
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0006_routing_geography_index"),
        ("buses", "0001_move_bus_models"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="BusRoute"),
                migrations.DeleteModel(name="Bus"),
            ],
        ),
    ]
