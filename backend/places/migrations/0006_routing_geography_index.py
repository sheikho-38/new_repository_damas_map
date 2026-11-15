from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('places', '0005_routingboardingpoint_routingedge_routingnode')]

    operations = [migrations.RunSQL(
        # Match the expression used by ST_DWithin in the routing snap query.
        'CREATE INDEX routing_edges_geography_gix '
        'ON routing_edges USING gist ((geom::geography))',
        'DROP INDEX routing_edges_geography_gix',
    )]
