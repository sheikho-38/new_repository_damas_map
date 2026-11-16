
# Create your models here.

from django.db import models


class Bus(models.Model):
    """A public transport line."""

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=150)
    color = models.CharField(max_length=20, default="#3a6962")

    old_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    new_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "buses"
        constraints = [
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
        ]

    def __str__(self):
        return self.name

    @property
    def code(self):
        return str(self.pk)

    @property
    def name_en(self):
        return ""


class BusRoute(models.Model):
    """A versioned route belonging to a bus and direction."""

    id = models.BigAutoField(primary_key=True)

    bus = models.ForeignKey(
        Bus,
        on_delete=models.CASCADE,
        related_name="routes",
    )

    version = models.PositiveIntegerField(default=1)

    geometry = models.JSONField(db_column="lineString")

    distance = models.FloatField(
        default=0,
        help_text="Metres",
    )

    trip_time = models.PositiveIntegerField(
        default=0,
        help_text="Minutes",
    )

    direction = models.CharField(
        max_length=50,
        choices=[
            ("outbound", "ذهاب"),
            ("inbound", "إياب"),
        ],
    )

    start_point = models.CharField(max_length=150, blank=True)
    end_point = models.CharField(max_length=150, blank=True)

    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = "bus_routes"
        constraints = [
            models.UniqueConstraint(
                fields=["bus", "direction", "version"],
                name="bus_route_unique_version",
            ),
            models.UniqueConstraint(
                fields=["bus", "direction"],
                condition=models.Q(is_active=True),
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
        ]

    def __str__(self):
        return f"{self.bus.name} ({self.direction}, v{self.version})"

    @property
    def specifications(self):
        return self

    @property
    def cost(self):
        return (
            self.bus.new_price
            if self.bus.new_price is not None
            else 0
        )

    @property
    def route_length_km(self):
        return self.distance / 1000

    @property
    def trip_time_minutes(self):
        return self.trip_time
