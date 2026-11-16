"""Shared constants and helpers for the routing seed commands."""

import hashlib
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent / 'seed_data' / 'routing'
TABLES = (
    'buses', 'bus_routes',
    'routing_nodes', 'routing_edges', 'routing_boarding_points',
    'routing_turn_restrictions', 'routing_car_states', 'routing_car_transitions',
)
CHUNK = 1024 * 1024


def text_file_sha256(path):
    """SHA-256 of a text file with LF line endings.

    Normalising CRLF keeps the hash identical on Windows, Linux and Docker checkouts.
    """
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
