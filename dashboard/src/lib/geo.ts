import type { LngLat } from '../types'

const toRad = (d: number) => (d * Math.PI) / 180

// المسافة بالأمتار بين نقطتين [lon, lat]
export function distanceMeters(a: number[], b: number[]): number {
  const R = 6371000
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// رقم أقرب نقطة من الخط للنقطة p (منستخدمها لإدراج نقطة بنص الخط)
export function nearestIdx(coords: number[][], p: LngLat): number {
  let best = 0
  let bestD = Infinity
  coords.forEach((c, i) => {
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

// الخط المحفوظ ما فيه نقاط تحكم، فمنأخد عينة موزعة على طوله
// (تقريباً كل كيلومتر، وبحد أقصى 15 نقطة)
export function sampleWaypoints(coords: number[][], stepMeters = 1000, max = 15): LngLat[] {
  let total = 0
  for (let i = 1; i < coords.length; i++) total += distanceMeters(coords[i - 1], coords[i])

  const step = Math.max(stepMeters, total / (max - 1))
  const first = coords[0]
  const last = coords[coords.length - 1]
  const out: LngLat[] = [[first[0], first[1]]]

  let acc = 0
  for (let i = 1; i < coords.length - 1; i++) {
    acc += distanceMeters(coords[i - 1], coords[i])
    if (acc >= step) {
      out.push([coords[i][0], coords[i][1]])
      acc = 0
    }
  }

  out.push([last[0], last[1]])
  return out
}