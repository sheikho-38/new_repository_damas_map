"""
يحاذي خطاً مرسوماً يدوياً (مثلاً على Google Satellite) مع طرق خريطة المشروع نفسها
(ملف mbtiles بصيغة OpenMapTiles، طبقة transportation) بدون أي routing:
كل نقطة تتحرك لأقرب طريق (بحد أقصى max_dev متر)، وإذا ما في طريق قريب تبقى كما هي.
"""
import gzip
import math
import sqlite3
from collections import defaultdict

TILE_ZOOM = 14
ROAD_CLASSES = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'}
SKIP_SERVICE = {'parking_aisle', 'driveway', 'drive-through'}


# ---------------------------------------------------------------- قراءة MVT
def _varint(buf, pos):
    result = shift = 0
    while True:
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, pos
        shift += 7


def _fields(buf):
    pos, end = 0, len(buf)
    while pos < end:
        key, pos = _varint(buf, pos)
        field, wire = key >> 3, key & 7
        if wire == 0:
            val, pos = _varint(buf, pos)
        elif wire == 2:
            length, pos = _varint(buf, pos)
            val = buf[pos:pos + length]
            pos += length
        elif wire == 1:
            val, pos = buf[pos:pos + 8], pos + 8
        elif wire == 5:
            val, pos = buf[pos:pos + 4], pos + 4
        else:
            raise ValueError('نوع حقل protobuf غير مدعوم')
        yield field, wire, val


def _packed(buf):
    out, pos = [], 0
    while pos < len(buf):
        v, pos = _varint(buf, pos)
        out.append(v)
    return out


def _value_string(buf):
    for field, wire, val in _fields(buf):
        if field == 1 and wire == 2:
            return val.decode('utf-8', 'replace')
    return None


def _to_lonlat(px, py, extent, z, x, y):
    n = 2 ** z
    lon = (x + px / extent) / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / extent) / n))))
    return lon, lat


def decode_roads(data, z, x, y):
    """يرجع قائمة (class, [(lon, lat), ...]) لطرق طبقة transportation من tile واحد."""
    roads = []
    for field, wire, layer in _fields(data):
        if field != 3 or wire != 2:
            continue
        name, extent, keys, values, feats = '', 4096, [], [], []
        for f, w, v in _fields(layer):
            if f == 1:
                name = v.decode('utf-8', 'replace')
            elif f == 2:
                feats.append(v)
            elif f == 3:
                keys.append(v.decode('utf-8', 'replace'))
            elif f == 4:
                values.append(v)
            elif f == 5:
                extent = v
        if name != 'transportation':
            continue
        strings = [_value_string(v) for v in values]
        for fb in feats:
            gtype, tags, geom = 0, [], []
            for f, w, v in _fields(fb):
                if f == 2:
                    tags.extend(_packed(v) if w == 2 else [v])
                elif f == 3:
                    gtype = v
                elif f == 4:
                    geom.extend(_packed(v) if w == 2 else [v])
            if gtype != 2:
                continue
            props = {}
            for i in range(0, len(tags) - 1, 2):
                if tags[i] < len(keys) and tags[i + 1] < len(strings):
                    props[keys[tags[i]]] = strings[tags[i + 1]]
            cls = props.get('class')
            if cls not in ROAD_CLASSES or props.get('service') in SKIP_SERVICE:
                continue
            lines, cur, cx, cy, i = [], None, 0, 0, 0
            while i < len(geom):
                cmd, count = geom[i] & 7, geom[i] >> 3
                i += 1
                if cmd in (1, 2):
                    for _ in range(count):
                        cx += (geom[i] >> 1) ^ -(geom[i] & 1)
                        cy += (geom[i + 1] >> 1) ^ -(geom[i + 1] & 1)
                        i += 2
                        if cmd == 1:
                            cur = [(cx, cy)]
                            lines.append(cur)
                        elif cur is not None:
                            cur.append((cx, cy))
            for line in lines:
                if len(line) >= 2:
                    roads.append((cls, [_to_lonlat(px, py, extent, z, x, y) for px, py in line]))
    return roads


def _tile_index(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def load_roads(mbtiles_path, bbox, zoom=TILE_ZOOM, margin=0.002):
    """يقرأ طرق كل tiles اللي بتغطي bbox = (west, south, east, north)."""
    west, south, east, north = bbox
    x0, y0 = _tile_index(west - margin, north + margin, zoom)
    x1, y1 = _tile_index(east + margin, south - margin, zoom)
    roads, tiles_found = [], 0
    db = sqlite3.connect(f'file:{mbtiles_path}?mode=ro', uri=True, timeout=5)
    try:
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                row = db.execute(
                    'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?',
                    (zoom, x, (2 ** zoom) - 1 - y)).fetchone()
                if row is None:
                    continue
                tiles_found += 1
                data = bytes(row[0])
                if data[:2] == b'\x1f\x8b':
                    data = gzip.decompress(data)
                roads.extend(decode_roads(data, zoom, x, y))
    finally:
        db.close()
    return roads, tiles_found


# ---------------------------------------------------------------- المحاذاة
def _bearing_diff(a, b):
    return abs((a - b + 90.0) % 180.0 - 90.0)  # بدون اعتبار الاتجاه، من 0 إلى 90


class _RoadIndex:
    def __init__(self, roads, kx, ky, cell=60.0):
        self.cell = cell
        self.segs = []
        self.grid = defaultdict(list)
        for road_id, (_cls, pts) in enumerate(roads):
            xy = [(lon * kx, lat * ky) for lon, lat in pts]
            for (ax, ay), (bx, by) in zip(xy, xy[1:]):
                if ax == bx and ay == by:
                    continue
                idx = len(self.segs)
                self.segs.append((ax, ay, bx, by, road_id, math.degrees(math.atan2(bx - ax, by - ay)) % 180.0))
                for gx in range(int(min(ax, bx) // cell) - 1, int(max(ax, bx) // cell) + 2):
                    for gy in range(int(min(ay, by) // cell) - 1, int(max(ay, by) // cell) + 2):
                        self.grid[(gx, gy)].append(idx)

    def candidates(self, px, py, radius, k=6):
        best = {}
        near = set()
        r = int(radius // self.cell) + 1
        gx, gy = int(px // self.cell), int(py // self.cell)
        for ix in range(gx - r, gx + r + 1):
            for iy in range(gy - r, gy + r + 1):
                near.update(self.grid.get((ix, iy), ()))
        for idx in near:
            ax, ay, bx, by, road_id, brg = self.segs[idx]
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
            qx, qy = ax + t * dx, ay + t * dy
            d = math.hypot(px - qx, py - qy)
            if d <= radius and (road_id not in best or d < best[road_id][0]):
                best[road_id] = (d, qx, qy, road_id, brg)
        return sorted(best.values())[:k]


def _simplify(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        far_i, far_d = -1, 0.0
        for i in range(a + 1, b):
            px, py = pts[i]
            if seg2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
                d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > far_d:
                far_i, far_d = i, d
        if far_d > tol:
            keep[far_i] = True
            stack.extend([(a, far_i), (far_i, b)])
    return [p for p, k in zip(pts, keep) if k]


def align_line(original, roads, max_dev=35.0, step=15.0, sigma=10.0, simplify_tol=1.5):
    """
    original: [[lon, lat], ...]. يرجع (النقاط الجديدة، إحصائيات).
    كل نقطة (كل ~15م) تُسقَط على أقرب طريق، مع مطابقة Viterbi حتى يبقى الخط على نفس الطريق.
    """
    lat0 = original[0][1]
    kx, ky = math.cos(math.radians(lat0)) * 111320.0, 110574.0
    index = _RoadIndex(roads, kx, ky)

    xy = [(lon * kx, lat * ky) for lon, lat in original]
    dense = [xy[0]]
    for a, b in zip(xy, xy[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) // step) + 1)
        for k in range(1, n + 1):
            f = k / n
            dense.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))

    N = len(dense)
    headings = []
    for i in range(N):
        a, b = dense[max(0, i - 2)], dense[min(N - 1, i + 2)]
        headings.append(math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) % 180.0)

    none_cost = 0.5 * (max_dev / sigma) ** 2 + 1.0
    states, emis = [], []
    for i, (px, py) in enumerate(dense):
        cands = index.candidates(px, py, max_dev)
        states.append(cands + [None])
        costs = []
        for c in cands:
            diff = _bearing_diff(c[4], headings[i])
            costs.append(0.5 * (c[0] / sigma) ** 2 + min(6.0, 0.5 * (diff / 30.0) ** 2))
        costs.append(none_cost)
        emis.append(costs)

    def trans(i, a, b):
        if a is None and b is None:
            return 0.0
        if a is None or b is None:
            return 1.0
        step_o = math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1])
        step_p = math.hypot(b[1] - a[1], b[2] - a[2])
        return abs(step_p - step_o) / 6.0 + (0.0 if a[3] == b[3] else 1.5)

    score = emis[0][:]
    back = [[-1] * len(states[0])]
    for i in range(1, N):
        new_score, ptr = [], []
        for j, b in enumerate(states[i]):
            best_v, best_k = None, 0
            for k, a in enumerate(states[i - 1]):
                v = score[k] + trans(i, a, b)
                if best_v is None or v < best_v:
                    best_v, best_k = v, k
            new_score.append(best_v + emis[i][j])
            ptr.append(best_k)
        score = new_score
        back.append(ptr)
    j = min(range(len(score)), key=score.__getitem__)
    chosen = [None] * N
    for i in range(N - 1, -1, -1):
        chosen[i] = states[i][j]
        j = back[i][j]

    # إزاحة كل نقطة؛ النقاط غير المطابقة تأخذ إزاحة مُستوفاة من أقرب نقطتين مطابقتين
    offs = [None if c is None else (c[1] - dense[i][0], c[2] - dense[i][1]) for i, c in enumerate(chosen)]
    matched_idx = [i for i, o in enumerate(offs) if o is not None]
    if not matched_idx:
        raise ValueError('ما في أي طريق ضمن المسافة المسموحة من الخط.')
    for i in range(N):
        if offs[i] is not None:
            continue
        prev = max((m for m in matched_idx if m < i), default=None)
        nxt = min((m for m in matched_idx if m > i), default=None)
        if prev is None:
            offs[i] = offs[nxt]
        elif nxt is None:
            offs[i] = offs[prev]
        else:
            f = (i - prev) / (nxt - prev)
            offs[i] = (offs[prev][0] + (offs[nxt][0] - offs[prev][0]) * f,
                       offs[prev][1] + (offs[nxt][1] - offs[prev][1]) * f)
    moved = [(dense[i][0] + offs[i][0], dense[i][1] + offs[i][1]) for i in range(N)]
    shifts = [math.hypot(*o) for o in offs]
    out_xy = _simplify(moved, simplify_tol)
    out = [[x / kx, y / ky] for x, y in out_xy]
    stats = {
        'matched_pct': round(100.0 * len(matched_idx) / N),
        'mean_shift_m': round(sum(shifts) / N, 1),
        'max_shift_m': round(max(shifts), 1),
        'points_in': len(original),
        'points_out': len(out),
    }
    return out, stats