"""Create or verify the six externally managed routing tables."""

import hashlib
import json
from pathlib import Path

import sqlparse
from django.db import migrations


TABLES = {
    'routing_nodes': 'ae47b5d4818b7167f730895874b1437b8b7b35138fc9f1c17467b30b71854acf',
    'routing_edges': '22db5fc5f326a54a34beaf45bb95eef36037850569bda165b17ce4420e7d2d39',
    'routing_boarding_points': 'e4a63b6c5e251726700d4f3adb6eda4a869151b4b0142b673962bebd0591cc3b',
    'routing_turn_restrictions': '5441dcc42539572208a41bee32ba8638279d3cd06c120fb83a33080551892cd8',
    'routing_car_states': 'be0c19ac4e1b73c9de3286c34de84f2c895f187ff615a1a52cce068361a45682',
    'routing_car_transitions': '989eb310b50fc403d0b19363ff657cf221075443f2a73cc1837160a40a2bf3b7',
}
SQL_SHA256 = 'a84776f4b6f9e95e2df14e0b6d6da66f099aeea67129f532b501c3aa8aaf1aca'


def structure_hash(cursor, name):
    cursor.execute("""SELECT a.attname, format_type(a.atttypid, a.atttypmod),
                             a.attnotnull, a.attidentity, a.attgenerated,
                             pg_get_expr(d.adbin, d.adrelid)
                      FROM pg_attribute a LEFT JOIN pg_attrdef d
                        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                      WHERE a.attrelid = %s::regclass AND a.attnum > 0
                        AND NOT a.attisdropped ORDER BY a.attnum""", (f'public.{name}',))
    columns = cursor.fetchall()
    cursor.execute("""SELECT conname, pg_get_constraintdef(oid)
                      FROM pg_constraint WHERE conrelid = %s::regclass ORDER BY conname""", (f'public.{name}',))
    constraints = []
    for constraint_name, definition in cursor.fetchall():
        # PostgreSQL 18 deparses these two array checks differently on fresh tables.
        if constraint_name in ('routing_nodes_node_type_check', 'routing_edges_edge_type_check'):
            definition = (definition.replace('ANY (ARRAY[(', 'ANY ((ARRAY[')
                          .replace("'::character varying)::text, ('", "'::character varying, '")
                          .replace("'::character varying)::text])))", "'::character varying])::text[])))"))
        constraints.append((constraint_name, definition))
    cursor.execute("""SELECT indexname, indexdef FROM pg_indexes
                      WHERE schemaname = 'public' AND tablename = %s ORDER BY indexname""", (name,))
    indexes = cursor.fetchall()
    cursor.execute('SELECT pg_get_serial_sequence(%s, %s)', (f'public.{name}', 'id'))
    sequence = cursor.fetchone()[0]
    if sequence:
        cursor.execute("""SELECT seqstart, seqincrement, seqmin, seqmax, seqcache, seqcycle
                          FROM pg_sequence WHERE seqrelid = %s::regclass""", (sequence,))
        sequence = cursor.fetchone()
    structure = {'columns': columns, 'constraints': constraints,
                 'indexes': indexes, 'sequence': sequence}
    return hashlib.sha256(json.dumps(structure, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def create_or_verify(apps, schema_editor):
    db = schema_editor.connection
    if db.vendor != 'postgresql':
        raise RuntimeError('Routing tables require PostgreSQL with PostGIS and pgRouting.')
    sql_file = Path(__file__).resolve().parents[1] / 'seed_data' / 'routing' / 'schema.sql'
    if not sql_file.is_file() or hashlib.sha256(sql_file.read_bytes()).hexdigest() != SQL_SHA256:
        raise RuntimeError('Routing schema.sql is missing or differs from the reviewed PostgreSQL schema.')

    with db.cursor() as cursor:
        cursor.execute("""SELECT e.extname, n.nspname FROM pg_extension e
                          JOIN pg_namespace n ON n.oid = e.extnamespace
                          WHERE e.extname IN ('postgis', 'pgrouting')""")
        extensions = dict(cursor.fetchall())
        if set(extensions) != {'postgis', 'pgrouting'}:
            raise RuntimeError('Install and enable the PostGIS and pgRouting extensions before migrate.')
        if extensions['postgis'] != 'public':
            raise RuntimeError('PostGIS must be installed in public for this routing schema.')
        cursor.execute('SHOW server_version_num')
        if int(cursor.fetchone()[0]) // 10000 != 18:
            raise RuntimeError('This routing schema was captured from PostgreSQL 18.')

        present = set()
        for name in TABLES:
            cursor.execute('SELECT to_regclass(%s)', (f'public.{name}',))
            if cursor.fetchone()[0] is not None:
                present.add(name)
        if present and present != set(TABLES):
            raise RuntimeError('Only some routing tables exist; resolve the partial schema before migrate.')
        if not present:
            cursor.execute("SELECT has_schema_privilege(current_user, 'public', 'CREATE')")
            if not cursor.fetchone()[0]:
                raise RuntimeError('Database user needs CREATE permission on public to create routing tables.')
            for statement in sqlparse.split(sql_file.read_text(encoding='utf-8')):
                cursor.execute(statement)
        for name, expected in TABLES.items():
            if structure_hash(cursor, name) != expected:
                raise RuntimeError(f'Routing table {name} differs from the reviewed schema; no data was changed.')


class Migration(migrations.Migration):
    dependencies = [('places', '0003_widen_place_bounds_for_rubble_sites')]

    operations = [migrations.RunPython(create_or_verify, reverse_code=migrations.RunPython.noop)]
