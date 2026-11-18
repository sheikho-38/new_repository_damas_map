
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("places", "0005_routingboardingpoint_routingedge_routingnode"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="Bus",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                primary_key=True,
                                serialize=False,
                            ),
                        ),
                        ("name", models.CharField(max_length=150)),
                        (
                            "color",
                            models.CharField(
                                default="#3a6962",
                                max_length=20,
                            ),
                        ),
                        (
                            "old_price",
                            models.DecimalField(
                                blank=True,
                                decimal_places=2,
                                max_digits=10,
                                null=True,
                            ),
                        ),
                        (
                            "new_price",
                            models.DecimalField(
                                blank=True,
                                decimal_places=2,
                                max_digits=10,
                                null=True,
                            ),
                        ),
                        ("is_active", models.BooleanField(default=True)),
                    ],
                    options={
                        "db_table": "buses",
                        "constraints": [
                            models.CheckConstraint(
                                condition=(
                                    models.Q(old_price__gte=0)
                                    | models.Q(old_price__isnull=True)
                                ),
                                name="bus_old_price_nonnegative",
                            ),
                            models.CheckConstraint(
                                condition=(
                                    models.Q(new_price__gte=0)
                                    | models.Q(new_price__isnull=True)
                                ),
                                name="bus_new_price_nonnegative",
                            ),
                        ],
                    },
                ),
                migrations.CreateModel(
                    name="BusRoute",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                primary_key=True,
                                serialize=False,
                            ),
                        ),
                        (
                            "version",
                            models.PositiveIntegerField(default=1),
                        ),
                        (
                            "geometry",
                            models.JSONField(db_column="lineString"),
                        ),
                        (
                            "distance",
                            models.FloatField(
                                default=0,
                                help_text="Metres",
                            ),
                        ),
                        (
                            "trip_time",
                            models.PositiveIntegerField(
                                default=0,
                                help_text="Minutes",
                            ),
                        ),
                        (
                            "direction",
                            models.CharField(
                                choices=[
                                    ("outbound", "ذهاب"),
                                    ("inbound", "إياب"),
                                ],
                                max_length=50,
                            ),
                        ),
                        (
                            "start_point",
                            models.CharField(
                                blank=True,
                                max_length=150,
                            ),
                        ),
                        (
                            "end_point",
                            models.CharField(
                                blank=True,
                                max_length=150,
                            ),
                        ),
                        (
                            "is_active",
                            models.BooleanField(default=False),
                        ),
                        (
                            "bus",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="routes",
                                to="buses.bus",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "bus_routes",
                        "constraints": [
                            models.UniqueConstraint(
                                fields=("bus", "direction", "version"),
                                name="bus_route_unique_version",
                            ),
                            models.UniqueConstraint(
                                condition=models.Q(is_active=True),
                                fields=("bus", "direction"),
                                name="bus_route_one_active_direction",
                            ),
                            models.CheckConstraint(
                                condition=models.Q(version__gte=1),
                                name="bus_route_positive_version",
                            ),
                            models.CheckConstraint(
                                condition=models.Q(distance__gte=0),
                                name="bus_route_distance_nonnegative",
                            ),
                            models.CheckConstraint(
                                condition=models.Q(
                                    direction__in=["outbound", "inbound"]
                                ),
                                name="bus_route_valid_direction",
                            ),
                        ],
                    },
                ),
            ],
        ),
    ]
