"""Load a verified project-local seed after Django migrations."""

import gzip
import hashlib
import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


TABLES = (
    'buses', 'bus_routes',
    'routing_nodes', 'routing_edges', 'routing_boarding_points',
    'routing_turn_restrictions', 'routing_car_states', 'routing_car_transitions',
)
SEED_DIR = Path(__file__).resolve().parents[2] / 'seed_data' / 'routing'
CHUNK = 1024 * 1024


def schema_of(cursor, name):
    cursor.execute("""SELECT a.attname, format_type(a.atttypid, a.atttypmod),
                             a.attnotnull, a.attidentity, a.attgenerated,
                             pg_get_expr(d.adbin, d.adrelid)
                      FROM pg_attribute a LEFT JOIN pg_attrdef d
                        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                      WHERE a.attrelid = %s::regclass AND a.attnum > 0
                        AND NOT a.attisdropped ORDER BY a.attnum""", (f'public.{name}',))
    columns = [list(row) for row in cursor.fetchall()]
    cursor.execute("""SELECT conname, pg_get_constraintdef(oid)
                      FROM pg_constraint WHERE conrelid = %s::regclass ORDER BY conname""", (f'public.{name}',))
    constraints = []
    for constraint_name, definition in cursor.fetchall():
        # Match the equivalent PostgreSQL 18 form accepted by migration 0004.
        if constraint_name in ('routing_nodes_node_type_check', 'routing_edges_edge_type_check'):
            definition = (definition.replace('ANY (ARRAY[(', 'ANY ((ARRAY[')
                          .replace("'::character varying)::text, ('", "'::character varying, '")
                          .replace("'::character varying)::text])))", "'::character varying])::text[])))"))
        constraints.append([constraint_name, definition])
    cursor.execute("""SELECT indexname, indexdef FROM pg_indexes
                      WHERE schemaname = 'public' AND tablename = %s ORDER BY indexname""", (name,))
    indexes = [list(row) for row in cursor.fetchall()]
    cursor.execute('SELECT pg_get_serial_sequence(%s, %s)', (f'public.{name}', 'id'))
    sequence = cursor.fetchone()[0]
    if sequence:
        cursor.execute("""SELECT seqstart, seqincrement, seqmin, seqmax, seqcache, seqcycle
                          FROM pg_sequence WHERE seqrelid = %s::regclass""", (sequence,))
        sequence = list(cursor.fetchone())
    return {'columns': columns, 'constraints': constraints,
            'indexes': indexes, 'sequence': sequence}


def digest_table(cursor, name):
    digest = hashlib.sha256()
    with cursor.copy(f'COPY (SELECT * FROM public.{name} ORDER BY id) TO STDOUT (FORMAT binary)') as copy:
        while block := copy.read():
            digest.update(block)
    return digest.hexdigest()


class Command(BaseCommand):
    help = 'Load routing and bus seed into empty PostgreSQL tables, or skip identical data.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('Routing seed requires PostgreSQL.')
        schema_file = SEED_DIR / 'schema.sql'
        manifest_file = SEED_DIR / 'manifest.json'
        if not schema_file.is_file() or not manifest_file.is_file():
            raise CommandError('Missing schema.sql or manifest.json. Run export_routing_seed on the source database first.')
        try:
            manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
            if manifest['format'] != 'postgres-binary-copy-gzip-v1' or set(manifest['tables']) != set(TABLES):
                raise ValueError('Unsupported or incomplete manifest')
            if hashlib.sha256(schema_file.read_bytes()).hexdigest() != manifest['schema_sha256']:
                raise ValueError('Routing schema checksum differs from manifest')
            for name in TABLES:
                info = manifest['tables'][name]
                if info['file'] != f'{name}.copy.gz' or not isinstance(info['rows'], int) or info['rows'] < 0:
                    raise ValueError(f'Invalid manifest entry: {name}')
                path = SEED_DIR / info['file']
                zipped_hash = hashlib.sha256()
                with path.open('rb') as source:
                    while block := source.read(CHUNK):
                        zipped_hash.update(block)
                if zipped_hash.hexdigest() != info['sha256'] or path.stat().st_size != info['bytes']:
                    raise ValueError(f'Seed file checksum differs: {name}')
                raw_hash = hashlib.sha256()
                with gzip.open(path, 'rb') as source:
                    while block := source.read(CHUNK):
                        raw_hash.update(block)
                if raw_hash.hexdigest() != info['copy_sha256']:
                    raise ValueError(f'Uncompressed seed checksum differs: {name}')
        except (OSError, KeyError, TypeError, ValueError, EOFError) as exc:
            raise CommandError(f'Routing seed validation failed: {exc}') from exc

        try:
            with transaction.atomic():
                connection.ensure_connection()
                with connection.connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', ('seed_routing',))
                    cursor.execute('SHOW server_version_num')
                    if int(cursor.fetchone()[0]) // 10000 != manifest['postgres_major']:
                        raise CommandError('PostgreSQL major version differs from seed; binary COPY is not portable across versions.')
                    cursor.execute("SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'pgrouting')")
                    if dict(cursor.fetchall()) != manifest['extensions']:
                        raise CommandError('PostGIS/pgRouting versions differ from seed; install matching extensions first.')

                    present = {}
                    for name in TABLES:
                        cursor.execute('SELECT to_regclass(%s)', (f'public.{name}',))
                        exists = cursor.fetchone()[0] is not None
                        if not exists:
                            raise CommandError(f'Missing table {name}; run migrate first.')
                        if schema_of(cursor, name) != manifest['tables'][name]['schema']:
                            raise CommandError(f'Existing table schema differs: {name}')
                        cursor.execute(f'SELECT count(*) FROM public.{name}')
                        present[name] = cursor.fetchone()[0]

                    populated = [name for name in TABLES if present[name]]
                    if populated:
                        for name in TABLES:
                            expected = manifest['tables'][name]['rows']
                            if present[name] != expected:
                                raise CommandError(f'Partial or different routing data in {name}; nothing changed.')
                            if digest_table(cursor, name) != manifest['tables'][name]['copy_sha256']:
                                raise CommandError(f'Routing data differs in {name}; nothing changed.')

                    if populated:
                        self.stdout.write(self.style.SUCCESS('Routing seed already present and identical; import skipped.'))
                        return

                    for name in TABLES:
                        columns = [row[0] for row in manifest['tables'][name]['schema']['columns']]
                        if not columns or any(not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', col) for col in columns):
                            raise CommandError(f'Invalid column list for {name}')
                        column_sql = ', '.join(f'"{col}"' for col in columns)
                        with gzip.open(SEED_DIR / manifest['tables'][name]['file'], 'rb') as source:
                            with cursor.copy(f"COPY public.{name} ({column_sql}) FROM STDIN (FORMAT binary)") as copy:
                                while block := source.read(CHUNK):
                                    copy.write(block)
                        cursor.execute(f'SELECT count(*) FROM public.{name}')
                        if cursor.fetchone()[0] != manifest['tables'][name]['rows']:
                            raise CommandError(f'Imported row count differs: {name}')
                        if digest_table(cursor, name) != manifest['tables'][name]['copy_sha256']:
                            raise CommandError(f'Imported data differs: {name}')

                    for name in TABLES:
                        cursor.execute('SELECT pg_get_serial_sequence(%s, %s)', (f'public.{name}', 'id'))
                        sequence = cursor.fetchone()[0]
                        if sequence:
                            cursor.execute(f'SELECT max(id) FROM public.{name}')
                            maximum = cursor.fetchone()[0]
                            cursor.execute('SELECT setval(%s::regclass, %s, %s)',
                                           (sequence, maximum if maximum is not None else 1, maximum is not None))
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f'Routing seed failed; transaction rolled back: {exc}') from exc
        for name in TABLES:
            self.stdout.write(f"{name}: {manifest['tables'][name]['rows']} rows")
        self.stdout.write(self.style.SUCCESS('Routing seed imported and verified.'))
