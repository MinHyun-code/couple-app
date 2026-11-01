import koreaRegionsData from './koreaRegions.json'

export type Region = {
  code: string
  name: string
  province: string
  fullName: string
  d: string
}

export const REGION_VIEWBOX: string = koreaRegionsData.viewBox
export const REGIONS: Region[] = koreaRegionsData.regions

const REGION_BY_CODE: Record<string, Region> = Object.fromEntries(REGIONS.map(r => [r.code, r]))

export function getRegionByCode(code: string | null | undefined): Region | null {
  if (!code) return null
  return REGION_BY_CODE[code] ?? null
}

export const PROVINCES: string[] = Array.from(new Set(REGIONS.map(r => r.province)))

export function getRegionsByProvince(province: string): Region[] {
  return REGIONS.filter(r => r.province === province)
}

const [, , VB_W_STR, VB_H_STR] = REGION_VIEWBOX.split(' ')
export const REGION_VIEWBOX_SIZE = { width: Number(VB_W_STR), height: Number(VB_H_STR) }

export type RegionBBox = { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number }

const BBOX_BY_CODE: Record<string, RegionBBox> = {}

// d 문자열에서 좌표를 파싱해 바운딩 박스를 구함 (검색 결과 확대용, 최초 호출 시 1회 계산 후 캐시)
export function getRegionBBox(code: string): RegionBBox | null {
  if (BBOX_BY_CODE[code]) return BBOX_BY_CODE[code]
  const region = getRegionByCode(code)
  if (!region) return null
  const nums = region.d.match(/-?\d+(\.\d+)?/g)
  if (!nums) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    const x = Number(nums[i]), y = Number(nums[i + 1])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const bbox = { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
  BBOX_BY_CODE[code] = bbox
  return bbox
}

type Point = [number, number]

const RINGS_BY_CODE: Record<string, Point[][]> = {}

// d 문자열("M x,y L x,y Z M x,y L x,y Z ...")을 서브패스(링) 단위의 점 목록으로 파싱, 캐시
function getRegionRings(code: string): Point[][] {
  if (RINGS_BY_CODE[code]) return RINGS_BY_CODE[code]
  const region = getRegionByCode(code)
  if (!region) return []
  const rings: Point[][] = []
  region.d.split('M').slice(1).forEach(sub => {
    const nums = sub.match(/-?\d+(\.\d+)?/g)
    if (!nums) return
    const pts: Point[] = []
    for (let i = 0; i < nums.length; i += 2) {
      pts.push([Number(nums[i]), Number(nums[i + 1])])
    }
    if (pts.length >= 3) rings.push(pts)
  })
  RINGS_BY_CODE[code] = rings
  return rings
}

function pointInRing(x: number, y: number, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// 점 (px,py)에서 선분 (ax,ay)-(bx,by)까지의 최단 거리
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx, cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

// 점에서 링(폴리곤 경계)까지의 최단 거리 — 경계에 얼마나 가까운 탭이었는지 판단하는 데 사용
function distToRing(px: number, py: number, ring: Point[]): number {
  let min = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distToSegment(px, py, ring[j][0], ring[j][1], ring[i][0], ring[i][1])
    if (d < min) min = d
  }
  return min
}

// 지도 탭 좌표(viewBox 단위)가 어느 시/군/구 안에 있는지 찾음. 먼저 바운딩 박스로 후보를 걸러낸 뒤
// 정확한 point-in-polygon 판정을 한다. 정확히 내부인 지역이 없으면(좌표 계산의 미세한 오차,
// 확대 시 정밀 탭 등으로 경계 바로 바깥을 짚은 경우) 허용 오차(tolerance) 내에서 경계까지
// 실제 거리가 가장 가까운 지역을 대신 선택한다 — 작은 지역일수록 이 보정이 중요하다.
export function findRegionAtPoint(x: number, y: number, tolerance = 6): Region | null {
  for (const region of REGIONS) {
    const bbox = getRegionBBox(region.code)
    if (!bbox) continue
    if (x < bbox.minX || x > bbox.maxX || y < bbox.minY || y > bbox.maxY) continue
    const rings = getRegionRings(region.code)
    if (rings.some(ring => pointInRing(x, y, ring))) return region
  }

  let closest: Region | null = null
  let closestDist = tolerance
  for (const region of REGIONS) {
    const bbox = getRegionBBox(region.code)
    if (!bbox) continue
    if (x < bbox.minX - tolerance || x > bbox.maxX + tolerance || y < bbox.minY - tolerance || y > bbox.maxY + tolerance) continue
    for (const ring of getRegionRings(region.code)) {
      const d = distToRing(x, y, ring)
      if (d < closestDist) {
        closestDist = d
        closest = region
      }
    }
  }
  return closest
}
