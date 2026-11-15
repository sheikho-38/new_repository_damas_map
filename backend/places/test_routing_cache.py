"""Run without a database: python -m unittest places.test_routing_cache -v."""

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from . import routing_cache as cache


class RoutingCacheTests(TestCase):
    def setUp(self):
        cache._entries.clear()
        self.connection = SimpleNamespace(in_atomic_block=False, get_autocommit=lambda: True)
        connection_patch = patch.object(cache, 'connection', self.connection)
        connection_patch.start()
        self.addCleanup(connection_patch.stop)
        version_patch = patch.object(cache, '_version', return_value=('database', 1))
        self.version = version_patch.start()
        self.addCleanup(version_patch.stop)
        self.addCleanup(cache._entries.clear)

    def test_reuses_work_without_rounding_coordinates_or_sharing_mutable_results(self):
        build = Mock(return_value={'coordinates': [[36.3, 33.5]]})
        first = cache.cached_routing(('walk', 36.300001), build)
        first['coordinates'][0][0] = 0
        second = cache.cached_routing(('walk', 36.300001), build)
        self.assertEqual(second['coordinates'][0][0], 36.3)
        self.assertEqual(build.call_count, 1)
        cache.cached_routing(('walk', 36.300002), build)
        cache.cached_routing(('car', 36.300001), build)
        self.assertEqual(build.call_count, 3)

    def test_commit_invalidates_prepared_routes(self):
        build = Mock(side_effect=['old', 'new'])
        self.assertEqual(cache.cached_routing('route', build), 'old')
        self.version.return_value = ('database', 2)
        self.assertEqual(cache.cached_routing('route', build), 'new')

    def test_concurrent_update_is_not_cached(self):
        self.version.side_effect = [1, 2, 2, 2]
        build = Mock(side_effect=['changed-during-build', 'consistent'])
        cache.cached_routing('route', build)
        self.assertEqual(len(cache._entries), 0)
        self.assertEqual(cache.cached_routing('route', build), 'consistent')
        self.assertEqual(build.call_count, 2)

    def test_own_uncommitted_changes_bypass_cache(self):
        self.connection.in_atomic_block = True
        build = Mock(side_effect=['first', 'second'])
        self.assertEqual(cache.cached_routing('route', build), 'first')
        self.assertEqual(cache.cached_routing('route', build), 'second')
        self.version.assert_not_called()
        self.assertFalse(cache._entries)

    def test_failures_are_not_cached(self):
        build = Mock(side_effect=[ValueError('unavailable'), 'recovered'])
        with self.assertRaises(ValueError):
            cache.cached_routing('route', build)
        self.assertEqual(cache.cached_routing('route', build), 'recovered')

    def test_cache_size_is_bounded(self):
        with patch.object(cache, 'MAX_ENTRIES', 2):
            for key in range(3):
                cache.cached_routing(key, lambda: key)
            self.assertEqual(len(cache._entries), 2)
            build = Mock(return_value='rebuilt')
            self.assertEqual(cache.cached_routing(0, build), 'rebuilt')
            build.assert_called_once()
