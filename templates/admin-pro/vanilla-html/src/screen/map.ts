import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite 把 worker 当静态资源 emit（?url）；maplibre-gl 6.x 用
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 构造 worker，
// 非 Vite 可静态分析的 `new Worker(new URL(...))` 模式，构建不会自动 emit，
// 须显式 setWorkerUrl（须在首个 Map 构造前调用）。
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection } from 'geojson'
import type { CountrySales } from '../data/screen'
import { currentLocale } from '../i18n'

setWorkerUrl(workerUrl)

// 世界地图：固定视图、禁所有交互、国家按 value 着色、中文标签 HTML 叠层。
// 离线：内联 style + 本地 world.geojson（无瓦片、零网络依赖）。
// 兜底：WebGL 不可用或 geojson fetch 失败时，只渲染 HTML 标签叠层
// （等距投影定位），无 crash。

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

// 与榜单一致的 locale-aware 紧凑单位（zh-CN→320万、en→3.2M）
function fmtValue(v: number): string {
  return new Intl.NumberFormat(currentLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)
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
  let disposed = false

  function cleanup(): void {
    disposed = true
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
      if (disposed) return
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
      // min===max 时 interpolate 退化（首尾同值），改用单色；
      // 保留 case 结构，无 value 国家仍走中性色
      const fillColor: DataDrivenPropertyValueSpecification<string> = [
        'case',
        ['has', 'value'],
        minValue === maxValue
          ? '#00d4ff'
          : ['interpolate', ['linear'], ['get', 'value'], minValue, '#1e3a5f', maxValue, '#00d4ff'],
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

      // duration:0 避免 fitBounds 默认 500ms ease 与 load 定位竞态
      // （ease 中途 load 触发会拿到中间相机坐标且永不修正）
      map.fitBounds(WORLD_BOUNDS, { padding: 0, duration: 0 })

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

      // 运行期错误（worker 失败、WebGL 上下文丢失等）：吞掉不冒泡 console，
      // 但若标签尚未定位（load 未触发）则降级到等距投影，保证标签可见
      map.on('error', () => {
        const first = labelEls.values().next().value as HTMLElement | undefined
        if (first && !first.style.left) positionLabelsFallback()
      })
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
