"""Export routing and bus tables without changing the database."""

import gzip
import hashlib
import json
from datetime import datetime, timezone
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


def table_schema(cursor, name):
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
    constraints = cursor.fetchall()
    cursor.execute("""SELECT indexname, indexdef FROM pg_indexes
                      WHERE schemaname = 'public' AND tablename = %s ORDER BY indexname""", (name,))
    indexes = cursor.fetchall()
    cursor.execute('SELECT pg_get_serial_sequence(%s, %s)', (f'public.{name}', 'id'))
    sequence = cursor.fetchone()[0]
    if sequence:
        cursor.execute("""SELECT seqstart, seqincrement, seqmin, seqmax, seqcache, seqcycle
                          FROM pg_sequence WHERE seqrelid = %s::regclass""", (sequence,))
        sequence = cursor.fetchone()
    return {'columns': columns, 'constraints': constraints,
            'indexes': indexes, 'sequence': sequence}


class Command(BaseCommand):
    help = 'Export routing and bus tables as compressed PostgreSQL binary COPY seed files.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('Routing seed requires PostgreSQL.')
        schema_file = SEED_DIR / 'schema.sql'
        if not schema_file.is_file():
            raise CommandError('Routing schema.sql is missing.')
        SEED_DIR.mkdir(parents=True, exist_ok=True)
        manifest = {
            'format': 'postgres-binary-copy-gzip-v1',
            'data_version': datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'),
            'created_at_utc': datetime.now(timezone.utc).isoformat(),
            'schema_sha256': hashlib.sha256(schema_file.read_bytes()).hexdigest(),
            'tables': {},
        }
        pending = []
        try:
            with transaction.atomic():
                with connection.cursor() as django_cursor:
                    django_cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                    raw = connection.connection
                    with raw.cursor() as cursor:
                        cursor.execute('SHOW server_version_num')
                        manifest['postgres_major'] = int(cursor.fetchone()[0]) // 10000
                        cursor.execute("SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'pgrouting')")
                        manifest['extensions'] = dict(cursor.fetchall())
                        if set(manifest['extensions']) != {'postgis', 'pgrouting'}:
                            raise CommandError('PostGIS and pgRouting are required.')
                        for name in TABLES:
                            cursor.execute('SELECT to_regclass(%s)', (f'public.{name}',))
                            if cursor.fetchone()[0] is None:
                                raise CommandError(f'Missing source table: {name}')
                            cursor.execute(f'SELECT count(*) FROM public.{name}')
                            count = cursor.fetchone()[0]
                            target = SEED_DIR / f'{name}.copy.gz'
                            temporary = target.with_suffix(target.suffix + '.tmp')
                            pending.append(temporary)
                            raw_hash = hashlib.sha256()
                            with temporary.open('wb') as output:
                                with gzip.GzipFile(fileobj=output, mode='wb', mtime=0) as zipped:
                                    with cursor.copy(f'COPY (SELECT * FROM public.{name} ORDER BY id) TO STDOUT (FORMAT binary)') as copy:
                                        while block := copy.read():
                                            zipped.write(block)
                                            raw_hash.update(block)
                            manifest['tables'][name] = {
                                'file': target.name, 'rows': count,
                                'schema': table_schema(cursor, name),
                                'copy_sha256': raw_hash.hexdigest(),
                            }
            for name in TABLES:
                target = SEED_DIR / manifest['tables'][name]['file']
                temporary = target.with_suffix(target.suffix + '.tmp')
                digest = hashlib.sha256()
                with temporary.open('rb') as source:
                    while block := source.read(CHUNK):
                        digest.update(block)
                manifest['tables'][name]['sha256'] = digest.hexdigest()
                manifest['tables'][name]['bytes'] = temporary.stat().st_size
                temporary.replace(target)
                pending.remove(temporary)
            manifest_tmp = SEED_DIR / 'manifest.json.tmp'
            pending.append(manifest_tmp)
            manifest_tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            manifest_tmp.replace(SEED_DIR / 'manifest.json')
            pending.remove(manifest_tmp)
        except Exception as exc:
            raise CommandError(f'Routing export failed: {exc}') from exc
        finally:
            for path in pending:
                path.unlink(missing_ok=True)
        for name in TABLES:
            self.stdout.write(f"{name}: {manifest['tables'][name]['rows']} rows")
        self.stdout.write(self.style.SUCCESS('Routing seed exported. Add manifest.json and *.copy.gz to Git.'))
