"""Focused transit selection checks without a live database."""

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from . import database_transit_routing_service as transit


START = [36.27, 33.51]
END = [36.28, 33.51]


def walk(seconds):
    return {
        'distance_m': 900,
        'duration_s': seconds,
        'start_snap_m': 0,
        'end_snap_m': 0,
        'geometry': {'type': 'LineString', 'coordinates': [START, END]},
    }


class TransitSelectionTests(TestCase):
    def setUp(self):
        coords = [START, END]
        route = SimpleNamespace(
            id=7, trip_time=1, cost=100, direction='outbound',
            bus_id=3, bus=SimpleNamespace(name='Test line', color='#D99432'),
        )
        self.routes = {7: (route, coords, transit._cumulative(coords))}
        self.candidates = {(7, 0): START, (7, 1): END}
        route_patch = patch.object(transit, '_routes', return_value=self.routes)
        candidate_patch = patch.object(transit, '_boarding_candidates', return_value=self.candidates)
        transfer_patch = patch.object(transit, '_transfers', return_value=[])
        for item in (route_patch, candidate_patch, transfer_patch):
            item.start()
            self.addCleanup(item.stop)

    def test_walk_wins_when_bus_is_slower_including_boarding_buffer(self):
        with patch.object(transit, '_walk', return_value=walk(350)):
            result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'walk')

    def test_bus_remains_when_it_is_faster(self):
        with patch.object(transit, '_walk', return_value=walk(500)):
            result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'transit')
        self.assertEqual(result['duration_s'], 360)
        self.assertEqual(result['transfers_count'], 0)

    def test_tie_prefers_walking(self):
        with patch.object(transit, '_walk', return_value=walk(360)):
            result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'walk')

    def test_bus_still_works_without_direct_walk(self):
        with patch.object(transit, '_walk', return_value=None):
            result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'transit')

    def test_walk_fallback_when_no_boarding_candidates(self):
        with patch.object(transit, '_boarding_candidates', return_value={}):
            with patch.object(transit, '_walk', return_value=walk(500)):
                result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'walk')

    def test_transfer_requires_a_reachable_directed_walk(self):
        transfer_from = [36.275, 33.51]
        transfer_to = [36.2751, 33.51]
        first = SimpleNamespace(
            id=7, trip_time=1, cost=100, direction='outbound',
            bus_id=3, bus=SimpleNamespace(name='First', color='#D99432'),
        )
        second = SimpleNamespace(
            id=8, trip_time=1, cost=100, direction='outbound',
            bus_id=4, bus=SimpleNamespace(name='Second', color='#2684C7'),
        )
        routes = {
            7: (first, [START, transfer_from], transit._cumulative([START, transfer_from])),
            8: (second, [transfer_to, END], transit._cumulative([transfer_to, END])),
        }
        candidates = {
            (7, 0): START, (7, 1): transfer_from,
            (8, 0): transfer_to, (8, 1): END,
        }

        def directed_walk(origin, destination):
            if origin == transfer_from and destination == transfer_to:
                return {
                    'distance_m': 10, 'duration_s': 10,
                    'start_snap_m': 0, 'end_snap_m': 0,
                    'geometry': {'type': 'LineString', 'coordinates': [origin, destination]},
                }
            return None

        with patch.object(transit, '_routes', return_value=routes), \
                patch.object(transit, '_boarding_candidates', return_value=candidates), \
                patch.object(transit, '_transfers', return_value=[((7, 1), (8, 0))]), \
                patch.object(transit, '_walk', side_effect=directed_walk):
            result = transit.calculate_database_transit_route(START, END)
        self.assertEqual(result['recommended_mode'], 'transit')
        self.assertEqual(result['transfers_count'], 1)
        self.assertEqual([leg['mode'] for leg in result['legs']], ['bus', 'walk', 'bus'])
