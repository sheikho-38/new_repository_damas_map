"""Standalone PostgreSQL routing for cars and walking."""

import json
import math

from django.db import connection


EDGE_SQL = {
    'car': "SELECT id, source, target, cost, reverse_cost FROM routing_edges WHERE edge_type = 'car'",
    'walk': ("SELECT id, source, target, "
             "CASE WHEN cost >= 0 THEN length_m ELSE -1 END AS cost, "
             "CASE WHEN reverse_cost >= 0 THEN length_m ELSE -1 END AS reverse_cost "
             "FROM routing_edges WHERE edge_type = 'walk'"),
}
SNAP_METRES = {'car': 500, 'walk': 100}


class DatabaseRoutingError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _point(value):
    try:
        lon, lat = float(value['lon']), float(value['lat'])
    except (KeyError, TypeError, ValueError) as exc:
        raise DatabaseRoutingError('invalid_coordinates', 'إحداثيات البداية أو النهاية غير صالحة') from exc
    if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
        raise DatabaseRoutingError('invalid_coordinates', 'إحداثيات البداية أو النهاية غير صالحة')
    return lon, lat


def _nearest_edge(cursor, point, mode):
    cursor.execute('''
        SELECT e.id, f.fraction,
               ST_X(ST_LineInterpolatePoint(e.geom, f.fraction)),
               ST_Y(ST_LineInterpolatePoint(e.geom, f.fraction)),
               ST_Distance(p.geom::geography,
                           ST_LineInterpolatePoint(e.geom, f.fraction)::geography) AS snap_m
        FROM routing_edges e
        CROSS JOIN (SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS geom) p
        CROSS JOIN LATERAL (SELECT ST_LineLocatePoint(e.geom, p.geom) AS fraction) f
        WHERE e.edge_type = %s AND (e.cost >= 0 OR e.reverse_cost >= 0)
          AND ST_DWithin(e.geom::geography, p.geom::geography, %s)
        ORDER BY snap_m, e.id
        LIMIT 1
    ''', (point[0], point[1], mode, SNAP_METRES[mode]))
    edge = cursor.fetchone()
    return edge if edge and edge[4] <= SNAP_METRES[mode] else None


def _car_pieces(cursor, origin, destination):
    """Route through directed car states; virtual arcs exist only in this query."""
    cursor.execute('''
        SELECT id, source, target, cost, reverse_cost
        FROM routing_edges WHERE id IN (%s, %s) AND edge_type = 'car'
    ''', (origin[0], destination[0]))
    edges = {row[0]: row for row in cursor.fetchall()}
    if len(edges) != len({origin[0], destination[0]}):
        raise DatabaseRoutingError('invalid_graph', 'حافة السيارة غير موجودة')

    def endpoint(point):
        edge = edges[point[0]]
        if point[1] <= 1e-10:
            return edge[1]
        if point[1] >= 1 - 1e-10:
            return edge[2]
        return None

    start_node, end_node = endpoint(origin), endpoint(destination)
    if start_node is not None and start_node == end_node:
        raise DatabaseRoutingError('empty_route', 'نقطتا البداية والنهاية عند العقدة نفسها')
    cursor.execute('SELECT MIN(id), MAX(id) FROM routing_car_transitions')
    first_id, last_id = cursor.fetchone()
    if first_id is None or first_id <= 0:
        raise DatabaseRoutingError('invalid_graph', 'انتقالات السيارة غير متاحة')
    virtual = []

    def add(source, target, edge_id, direction, first_f, last_f, full_cost):
        fraction = abs(last_f - first_f)
        if fraction <= 1e-10 or full_cost < 0:
            return
        if not math.isfinite(full_cost):
            raise DatabaseRoutingError('invalid_graph', 'تكلفة حافة غير صالحة')
        virtual.append({'id': last_id + len(virtual) + 1, 'source': source, 'target': target,
                        'cost': full_cost if fraction == 1.0 else None,
                        'full_cost': full_cost, 'length_m': None, 'reverse_cost': -1.0,
                        'edge_id': edge_id, 'direction': direction,
                        'first_f': first_f, 'last_f': last_f})

    if start_node is None:
        cursor.execute('''
            SELECT s.id, s.edge_id, s.direction, e.cost, e.reverse_cost
            FROM routing_car_states s JOIN routing_edges e ON e.id = s.edge_id
            WHERE s.is_initial AND s.edge_id = %s
        ''', (origin[0],))
    else:
        cursor.execute('''
            SELECT s.id, s.edge_id, s.direction, e.cost, e.reverse_cost
            FROM routing_car_states s JOIN routing_edges e ON e.id = s.edge_id
            WHERE s.is_initial AND s.source_node = %s
        ''', (start_node,))
    for state_id, edge_id, direction, cost, reverse_cost in cursor.fetchall():
        first = origin[1] if start_node is None else (0.0 if direction == 'forward' else 1.0)
        last = 1.0 if direction == 'forward' else 0.0
        add(-1, state_id, edge_id, direction, first, last,
            cost if direction == 'forward' else reverse_cost)

    if end_node is None:
        cursor.execute('''
            SELECT t.source, t.edge_id, t.direction, e.cost, e.reverse_cost
            FROM routing_car_transitions t JOIN routing_edges e ON e.id = t.edge_id
            WHERE t.edge_id = %s
        ''', (destination[0],))
        for state_id, edge_id, direction, cost, reverse_cost in cursor.fetchall():
            first = 0.0 if direction == 'forward' else 1.0
            add(state_id, -2, edge_id, direction, first, destination[1],
                cost if direction == 'forward' else reverse_cost)
    else:
        cursor.execute('SELECT id FROM routing_car_states WHERE target_node = %s', (end_node,))
        for (state_id,) in cursor.fetchall():
            virtual.append({'id': last_id + len(virtual) + 1, 'source': state_id, 'target': -2,
                            'cost': 0.0, 'reverse_cost': -1.0,
                            'edge_id': None, 'direction': None,
                            'first_f': None, 'last_f': None})

    if end_node is None:
        edge = edges[destination[0]]
        if origin[0] == destination[0]:
            if destination[1] > origin[1] + 1e-10:
                add(-1, -2, edge[0], 'forward', origin[1], destination[1], edge[3])
            elif origin[1] > destination[1] + 1e-10:
                add(-1, -2, edge[0], 'reverse', origin[1], destination[1], edge[4])
        elif start_node is not None:
            if start_node == edge[1]:
                add(-1, -2, edge[0], 'forward', 0.0, destination[1], edge[3])
            if start_node == edge[2]:
                add(-1, -2, edge[0], 'reverse', 1.0, destination[1], edge[4])

    partials = [arc for arc in virtual if arc.get('cost') is None]
    if partials:
        cursor.execute('''
            SELECT v.id, e.length_m,
                   ST_Length(ST_LineSubstring(e.geom,
                       LEAST(v.first_f, v.last_f),
                       GREATEST(v.first_f, v.last_f))::geography)
            FROM jsonb_to_recordset(%s::jsonb)
                 AS v(id bigint, edge_id bigint, first_f float8, last_f float8)
            JOIN routing_edges e ON e.id = v.edge_id
        ''', (json.dumps(partials),))
        lengths = {arc_id: (full_m, part_m) for arc_id, full_m, part_m in cursor.fetchall()}
        if len(lengths) != len(partials):
            raise DatabaseRoutingError('invalid_graph', 'طول حافة جزئية مفقود')
        for arc in partials:
            full_m, part_m = lengths[arc['id']]
            if (full_m is None or part_m is None or
                    not math.isfinite(full_m) or full_m <= 0 or not math.isfinite(part_m)):
                raise DatabaseRoutingError('invalid_graph', 'طول حافة غير صالح')
            if part_m > 0:
                arc['cost'] = arc['full_cost'] * part_m / full_m
                arc['length_m'] = part_m
        virtual = [arc for arc in virtual if arc['cost'] is not None]

    if not virtual:
        raise DatabaseRoutingError('no_route', 'لا يوجد مسار مسموح بين النقطتين')
    by_id = {arc['id']: arc for arc in virtual}
    cursor.execute('''
        SELECT path_seq, node, edge, cost FROM pgr_dijkstra(
            format('SELECT id, source, target, cost, -1::float8 AS reverse_cost
                    FROM routing_car_transitions UNION ALL
                    SELECT id, source, target, cost, reverse_cost
                    FROM jsonb_to_recordset(%%L::jsonb)
                    AS v(id bigint, source bigint, target bigint,
                         cost float8, reverse_cost float8)', %s),
            -1::bigint, -2::bigint, directed => true
        ) WHERE edge <> -1 ORDER BY path_seq
    ''', (json.dumps(virtual),))
    path = cursor.fetchall()
    if not path:
        raise DatabaseRoutingError('no_route', 'لا يوجد مسار مسموح بين النقطتين')

    transition_ids = [edge_id for _, _, edge_id, _ in path if edge_id not in by_id]
    transitions = {}
    if transition_ids:
        cursor.execute('''
            SELECT id, edge_id, direction, cost FROM routing_car_transitions
            WHERE id = ANY(%s)
        ''', (transition_ids,))
        transitions = {row[0]: row for row in cursor.fetchall()}
    pieces = []
    for _, _, path_edge, path_cost in path:
        if path_edge in by_id:
            arc = by_id[path_edge]
            edge_id, direction = arc['edge_id'], arc['direction']
            first, last = arc['first_f'], arc['last_f']
            expected = arc['cost']
            part_m = arc.get('length_m')
        else:
            transition = transitions.get(path_edge)
            if transition is None:
                raise DatabaseRoutingError('invalid_graph', 'انتقال سيارة غير معروف')
            _, edge_id, direction, expected = transition
            first, last = (0.0, 1.0) if direction == 'forward' else (1.0, 0.0)
            part_m = None
        if abs(path_cost - expected) > 1e-6:
            raise DatabaseRoutingError('invalid_graph', 'تكلفة انتقال غير متطابقة')
        if edge_id is not None:
            pieces.append({'ord': len(pieces), 'edge_id': edge_id,
                           'first_f': first, 'last_f': last,
                           'cost': path_cost, 'length_m': part_m})
    if not pieces:
        raise DatabaseRoutingError('empty_route', 'لا يوجد جزء قابل للاجتياز بين النقطتين')
    cursor.execute('''
        SELECT p.ord, p.cost, p.first_f, p.last_f,
               COALESCE(p.length_m, ST_Length(g.geom::geography)), ST_AsGeoJSON(g.geom)
        FROM jsonb_to_recordset(%s::jsonb)
             AS p(ord integer, edge_id bigint, first_f float8, last_f float8,
                  cost float8, length_m float8)
        JOIN routing_edges e ON e.id = p.edge_id
        CROSS JOIN LATERAL (
            SELECT CASE WHEN p.first_f < p.last_f
                THEN ST_LineSubstring(e.geom, p.first_f, p.last_f)
                ELSE ST_Reverse(ST_LineSubstring(e.geom, p.last_f, p.first_f))
            END AS geom
        ) g ORDER BY p.ord
    ''', (json.dumps(pieces),))
    rows = cursor.fetchall()
    if len(rows) != len(pieces):
        raise DatabaseRoutingError('invalid_graph', 'هندسة حافة مفقودة')
    return [(None, 0, cost, first, last, length, geom)
            for _, cost, first, last, length, geom in rows]


def calculate_database_route(start, end, mode):
    """Return an ordered GeoJSON route for {'lon', 'lat'} start/end points."""
    if not isinstance(mode, str) or mode not in EDGE_SQL:
        raise DatabaseRoutingError('invalid_mode', 'نوع التوجيه يجب أن يكون car أو walk')
    start, end = _point(start), _point(end)

    with connection.cursor() as cursor:
        origin = _nearest_edge(cursor, start, mode)
        destination = _nearest_edge(cursor, end, mode)
        if origin is None or destination is None:
            raise DatabaseRoutingError('no_nearby_edge', 'لا توجد حافة قابلة للتوجيه قرب إحدى النقطتين')

        if mode == 'car':
            if origin[0] == destination[0] and abs(origin[1] - destination[1]) <= 1e-10:
                raise DatabaseRoutingError('empty_route', 'نقطتا البداية والنهاية متطابقتان على الطريق')
            rows = _car_pieces(cursor, origin, destination)
        else:
            # pgRouting executes this SQL internally; format() receives only bound numeric values.
            points_sql = """SELECT pid, edge_id, fraction, side FROM
            (VALUES (1::bigint, %s::bigint, %s::float8, 'b'::char),
                    (2::bigint, %s::bigint, %s::float8, 'b'::char))
            AS points(pid, edge_id, fraction, side)"""
            cursor.execute("""
            WITH path AS (
                SELECT p.node, LEAD(p.node) OVER (ORDER BY p.path_seq) AS next_node,
                       p.edge, p.path_seq
                FROM pgr_withPoints(
                    %s, format(%s, %s::bigint, %s::float8, %s::bigint, %s::float8),
                    -1::bigint, -2::bigint, directed => true, details => true
                ) AS p
            ), fractions AS (
                SELECT p.path_seq, p.node, p.next_node, e.geom,
                       e.length_m, e.cost AS forward_s, e.reverse_cost AS reverse_s,
                    CASE WHEN p.node = -1 THEN %s::float8
                         WHEN p.node = -2 THEN %s::float8
                         WHEN p.node = e.source THEN 0.0
                         WHEN p.node = e.target THEN 1.0 END AS first_f,
                    CASE WHEN p.next_node = -1 THEN %s::float8
                         WHEN p.next_node = -2 THEN %s::float8
                         WHEN p.next_node = e.source THEN 0.0
                         WHEN p.next_node = e.target THEN 1.0 END AS last_f
                FROM path p JOIN routing_edges e ON e.id = p.edge
            ), pieces AS (
                SELECT path_seq, node, next_node, length_m, forward_s, reverse_s,
                       first_f, last_f,
                    CASE WHEN first_f <= last_f
                         THEN ST_LineSubstring(geom, first_f, last_f)
                         ELSE ST_Reverse(ST_LineSubstring(geom, last_f, first_f))
                    END AS geom
                FROM fractions
            ), measured AS (
                SELECT *, ST_Length(geom::geography) AS metres FROM pieces
            )
            SELECT node, next_node,
                   CASE WHEN metres = 0 THEN 0
                        WHEN length_m > 0 AND
                             (CASE WHEN first_f <= last_f THEN forward_s ELSE reverse_s END) >= 0
                        THEN metres / length_m *
                             (CASE WHEN first_f <= last_f THEN forward_s ELSE reverse_s END)
                   END AS cost,
                   first_f, last_f, metres, ST_AsGeoJSON(geom)
            FROM measured ORDER BY path_seq
        """, (EDGE_SQL[mode], points_sql,
              origin[0], origin[1], destination[0], destination[1],
              origin[1], destination[1], origin[1], destination[1]))
            rows = cursor.fetchall()

    if not rows:
        raise DatabaseRoutingError('no_route', 'لا يوجد اتصال بين نقطتي البداية والنهاية')

    coordinates = []
    distance_m = duration_s = 0.0
    for node, next_node, cost, first_f, last_f, length_m, geometry in rows:
        if first_f is None or last_f is None or next_node is None:
            raise DatabaseRoutingError('invalid_graph', 'تعذر تحديد طرف جزء من المسار')
        if mode == 'walk' and (cost is None or not math.isfinite(cost)):
            raise DatabaseRoutingError('invalid_graph', 'تكلفة حافة مشي غير صالحة')
        if first_f == last_f:
            if abs(cost) > 1e-8:
                raise DatabaseRoutingError('invalid_graph', 'تكلفة غير صفرية لجزء بلا طول')
            continue
        part = json.loads(geometry)
        if part['type'] != 'LineString':
            raise DatabaseRoutingError('invalid_graph', 'هندسة جزء من المسار غير صالحة')
        segment = part['coordinates']
        if coordinates:
            if any(abs(a - b) > 1e-7 for a, b in zip(coordinates[-1], segment[0])):
                raise DatabaseRoutingError('invalid_graph', 'أجزاء المسار غير متصلة')
            coordinates.extend(segment[1:])
        else:
            coordinates.extend(segment)
        distance_m += length_m
        duration_s += cost

    if len(coordinates) < 2:
        raise DatabaseRoutingError('empty_route', 'لا يوجد جزء قابل للاجتياز بين النقطتين')
    if (any(abs(a - b) > 1e-7 for a, b in zip(coordinates[0], origin[2:4])) or
            any(abs(a - b) > 1e-7 for a, b in zip(coordinates[-1], destination[2:4]))):
        raise DatabaseRoutingError('invalid_graph', 'طرفا المسار لا يطابقان نقطتي الإسقاط')

    geometry = {'type': 'LineString', 'coordinates': coordinates}
    return {
        'mode': mode, 'geometry': geometry,
        'route_geojson': {'type': 'Feature', 'geometry': geometry,
                          'properties': {'mode': mode, 'distance_m': distance_m,
                                         'duration_s': duration_s}},
        'distance_m': distance_m, 'duration_s': duration_s,
        'snapped_start': list(origin[2:4]), 'snapped_end': list(destination[2:4]),
        'start_snap_m': origin[4], 'end_snap_m': destination[4],
        'instructions': [],
    }
