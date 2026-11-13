import { Map as MapLibreMap } from 'maplibre-gl'
import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import type { CountrySales } from '../data/screen'

// 世界地图：固定视图、禁所有交互、国家按 value 着色、中文标签 HTML 叠层。
// 离线：内联 style + 本地 world.geojson（无瓦片、零网络依赖）。
// 兜底：WebGL 不可用或 geojson fetch 失败时，只渲染 HTML 标签叠层
// （等距投影定位），无 console error、无 crash。

// 世界边界（fitBounds 与 fallback 投影共用，保持两者对齐）
const WORLD_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85]

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// 与榜单一致的「万」单位
function fmtValue(v: number): string {
  return `${Math.round(v / 10000)}万`
}

// 等距投影（fallback 用），与 WORLD_BOUNDS 对齐，坐标为容器 layout px
function projectFallback(lng: number, lat: number, w: number, h: number): { x: number; y: number } {
  const x = ((lng - WORLD_BOUNDS[0]) / (WORLD_BOUNDS[2] - WORLD_BOUNDS[0])) * w
  const y = ((WORLD_BOUNDS[3] - lat) / (WORLD_BOUNDS[3] - WORLD_BOUNDS[1])) * h
  return { x, y }
}

export function initMap(container: HTMLElement, countries: CountrySales[]): () => void {
  const values = countries.map((c) => c.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  // 标签叠层（恒渲染；地图可用时由 map.project 重定位）
  const labels = document.createElement('div')
  labels.className = 'map-labels'
  const labelEls = new Map<string, HTMLElement>()
  for (const c of countries) {
    const el = document.createElement('div')
    el.className = 'map-label'
    el.setAttribute('data-country', c.key)
    el.textContent = `${c.name} ${fmtValue(c.value)}`
    labels.appendChild(el)
    labelEls.set(c.key, el)
  }
  container.appendChild(labels)

  function positionLabelsFallback(): void {
    const w = container.clientWidth
    const h = container.clientHeight
    for (const c of countries) {
      const el = labelEls.get(c.key)
      if (!el) continue
      const { x, y } = projectFallback(c.lng, c.lat, w, h)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
  }

  let map: MapLibreMap | null = null

  function cleanup(): void {
    if (map) {
      map.remove()
      map = null
    }
    labels.remove()
  }

  // 兜底路径：无 WebGL 或 geojson 缺失 → 只渲染标签
  function fallback(): void {
    positionLabelsFallback()
  }

  if (!webglAvailable()) {
    fallback()
    return cleanup
  }

  fetch('./world.geojson')
    .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
    .then((geojson) => {
      if (!geojson) {
        fallback()
        return
      }
      // 按 ISO_A3 注入 value（world.geojson 的 ISO_A3 取自 Natural Earth ADM0_A3）
      const byIso = new Map(countries.map((c) => [c.iso3, c.value]))
      for (const f of geojson.features) {
        const props = f.properties
        const iso = props?.ISO_A3 as string | undefined
        if (props && iso && byIso.has(iso)) props.value = byIso.get(iso)
      }
      // min===max 时 interpolate 退化，改用单色
      const fillColor: DataDrivenPropertyValueSpecification<string> =
        minValue === maxValue
          ? '#00d4ff'
          : [
              'case',
              ['has', 'value'],
              [
                'interpolate',
                ['linear'],
                ['get', 'value'],
                minValue,
                '#1e3a5f',
                maxValue,
                '#00d4ff',
              ],
              '#16213e',
            ]

      try {
        map = new MapLibreMap({
          container,
          style: {
            version: 8,
            sources: { world: { type: 'geojson', data: geojson } },
            layers: [
              { id: 'background', type: 'background', paint: { 'background-color': '#040a1c' } },
              {
                id: 'world-fill',
                type: 'fill',
                source: 'world',
                paint: { 'fill-color': fillColor, 'fill-opacity': 0.85 },
              },
              {
                id: 'world-line',
                type: 'line',
                source: 'world',
                paint: { 'line-color': '#1e293b', 'line-width': 0.6 },
              },
            ],
          },
          center: [0, 20],
          zoom: 1,
          attributionControl: false,
        })
      } catch {
        fallback()
        return
      }

      // 固定视图：禁所有交互
      map.dragPan.disable()
      map.dragRotate.disable()
      map.scrollZoom.disable()
      map.boxZoom.disable()
      map.doubleClickZoom.disable()
      map.keyboard.disable()
      map.touchZoomRotate.disable()

      map.fitBounds(WORLD_BOUNDS, { padding: 0 })

      // 固定视图下投影稳定：load 后一次定位即可
      map.on('load', () => {
        if (!map) return
        for (const c of countries) {
          const el = labelEls.get(c.key)
          if (!el) continue
          const p = map.project([c.lng, c.lat])
          el.style.left = `${p.x}px`
          el.style.top = `${p.y}px`
        }
      })

      // 吞掉地图运行期错误（如 WebGL 上下文丢失）——标签仍在，不冒泡 console
      map.on('error', () => {})
    })
    .catch(() => {
      fallback()
    })

  return cleanup
}

export function updateMapLabels(container: HTMLElement, countries: CountrySales[]): void {
  // 固定视图下标签位置不变，只更新数值文本
  for (const c of countries) {
    const el = container.querySelector<HTMLElement>(`.map-label[data-country="${c.key}"]`)
    if (el) el.textContent = `${c.name} ${fmtValue(c.value)}`
  }
}
