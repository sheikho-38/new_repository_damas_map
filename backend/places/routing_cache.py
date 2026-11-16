"""Reuse prepared route parts in memory, invalidating on PostgreSQL commits.

Like MAUI's in-memory routing data, this avoids rebuilding unchanged work.
The full MVCC snapshot invalidates conservatively (even on unrelated writes).
No coordinate rounding, cached failures, or reuse inside writable transactions.
"""

from collections import OrderedDict
from copy import deepcopy
from threading import Lock

from django.db import connection


_entries = OrderedDict()
_lock = Lock()
MAX_ENTRIES = 128


def _version():
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_current_snapshot()::text, pg_postmaster_start_time(), "
                       "current_database(), current_user, current_setting('search_path')")
        return (connection.settings_dict.get('HOST'), connection.settings_dict.get('PORT'),
                *cursor.fetchone())


def cached_routing(key, compute):
    # A transaction can see its own uncommitted writes without changing its snapshot.
    if connection.in_atomic_block or not connection.get_autocommit():
        return compute()
    version = _version()
    cache_key = (version, key)
    with _lock:
        if cache_key in _entries:
            _entries.move_to_end(cache_key)
            return deepcopy(_entries[cache_key])
    value = compute()
    # Do not publish work built across a concurrent update.
    if version == _version():
        with _lock:
            _entries[cache_key] = deepcopy(value)
            _entries.move_to_end(cache_key)
            while len(_entries) > MAX_ENTRIES:
                _entries.popitem(last=False)
    return value
