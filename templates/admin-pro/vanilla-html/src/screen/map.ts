import type {
  Map as MapLibreMap,
  DataDrivenPropertyValueSpecification,
  GeoJSONSource,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite 把 worker 当静态资源 emit（?url）；maplibre-gl 6.x 用
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 构造 worker，
// 非 Vite 可静态分析的 `new Worker(new URL(...))` 模式，构建不会自动 emit，
// 须显式 setWorkerUrl（须在首个 Map 构造前调用，故随动态 import 在 async 路径里调）。
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature, FeatureCollection } from 'geojson'
import type { CountrySales } from '../data/screen'
import { currentLocale } from '../i18n'

// 运行时 maplibre-gl 改动态 import（screen chunk 与 maplibre chunk 分包）：
// 顶层只剩类型 import + CSS + worker url，模块加载零副作用。

export interface MapController {
  dispose(): void
  update(countries: CountrySales[]): void
}

export interface LabelBox {
  key: string
  x: number
  y: number
  w: number
  h: number
}

// 标签避让：items 已按调用方优先级（value 降序）排列，逐个与已保留集合做
// AABB 相交判定（含 pad 外扩；相接即判相交，见测试「边缘相距 8px」用例），
// 返回保留（可见）key 集合。pad 默认 4px。
export function pickVisibleLabels(items: LabelBox[], pad = 4): Set<string> {
  const kept: LabelBox[] = []
  const visible = new Set<string>()
  for (const it of items) {
    const minX = it.x - it.w / 2 - pad
    const maxX = it.x + it.w / 2 + pad
    const minY = it.y - it.h / 2 - pad
    const maxY = it.y + it.h / 2 + pad
    const hit = kept.some(
      (k) =>
        minX <= k.x + k.w / 2 + pad &&
        k.x - k.w / 2 - pad <= maxX &&
        minY <= k.y + k.h / 2 + pad &&
        k.y - k.h / 2 - pad <= maxY,
    )
    if (!hit) {
      kept.push(it)
      visible.add(it.key)
    }
  }
  return visible
}

// 补间序列：length===steps 的线性序列，末元素精确等于 to
// （tweenSteps(0,100,10) → [10,20,…,100]），末值直接取 to 避免浮点累积误差。
export function tweenSteps(from: number, to: number, steps: number): number[] {
  const step = (to - from) / steps
  return Array.from({ length: steps }, (_, i) => (i === steps - 1 ? to : from + step * (i + 1)))
}

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

export function initMap(container: HTMLElement, countries: CountrySales[]): MapController {
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

  let map: MapLibreMap | null = null
  let disposed = false
  let geojson: FeatureCollection | null = null
  // update 早于就绪时暂存最新一次数据（latest-wins，单个字段）
  let pending: CountrySales[] | null = null
  let rafId = 0
  // 当前已注入 geojson 的各国值（iso3 → value），补间的起点快照
  const injected = new Map<string, number>()
  // 各国当前最新值（key → value），避让排序按 value 降序取优先级
  let latest = new Map(countries.map((c) => [c.key, c.value]))
  // ISO_A3 → feature 索引（world.geojson 的 ISO_A3 取自 Natural Earth ADM0_A3），
  // 补间每帧按 iso 直写 feature，避免遍历全量要素
  let featureByIso = new Map<string, Feature>()

  function injectValue(iso: string, value: number): void {
    const props = featureByIso.get(iso)?.properties
    if (props) props.value = value
  }

  function injectAll(byIso: Map<string, number>): void {
    for (const [iso, value] of byIso) {
      injectValue(iso, value)
      injected.set(iso, value)
    }
  }

  function refreshLabelTexts(cs: CountrySales[]): void {
    for (const c of cs) {
      const el = labelEls.get(c.key)
      if (el) el.textContent = `${c.name} ${fmtValue(c.value)}`
    }
  }

  // 优先级避让：收集已定位标签的 AABB（无 layout 信息时按文本长度估算），
  // 按 value 降序（高优先级在前）交给 pickVisibleLabels，逐个 toggle .is-hidden
  function applyDeclutter(): void {
    const boxes: LabelBox[] = []
    for (const c of countries) {
      const el = labelEls.get(c.key)
      if (!el?.style.left || !el.style.top) continue
      const text = el.textContent ?? ''
      boxes.push({
        key: c.key,
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top),
        w: el.offsetWidth || text.length * 7,
        h: el.offsetHeight || 16,
      })
    }
    boxes.sort((a, b) => (latest.get(b.key) ?? 0) - (latest.get(a.key) ?? 0))
    const visible = pickVisibleLabels(boxes)
    for (const b of boxes) {
      labelEls.get(b.key)?.classList.toggle('is-hidden', !visible.has(b.key))
    }
  }

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
    applyDeclutter()
  }

  function dispose(): void {
    disposed = true
    cancelAnimationFrame(rafId)
    if (map) {
      map.remove()
      map = null
    }
    labels.remove()
  }

  // 兜底路径：无 WebGL、geojson 缺失或地图构造失败 → 只渲染标签。
  // error 时若 pending 未应用（地图从未就绪）则应用到标签文本，保证数值不过期
  function fallback(): void {
    if (pending) {
      refreshLabelTexts(pending)
      pending = null
    }
    positionLabelsFallback()
  }

  // WebGL 不可用：返回只更新标签文本的 fallback controller
  if (!webglAvailable()) {
    positionLabelsFallback()
    return {
      dispose,
      update: (cs) => refreshLabelTexts(cs),
    }
  }

  void (async () => {
    const [ml, fetched] = await Promise.all([
      import('maplibre-gl'),
      fetch('./world.geojson').then((r) =>
        r.ok ? (r.json() as Promise<FeatureCollection>) : null,
      ),
    ])
    if (disposed) return
    if (!fetched) {
      fallback()
      return
    }
    geojson = fetched
    featureByIso = new Map<string, Feature>()
    for (const f of geojson.features) {
      const iso = f.properties?.ISO_A3 as string | undefined
      if (iso) featureByIso.set(iso, f)
    }

    // 挂载时刻初值注入
    injectAll(new Map(countries.map((c) => [c.iso3, c.value])))

    // min===max 时 interpolate 退化（首尾同值），改用单色；
    // 保留 case 结构，无 value 国家仍走中性色。
    // min/max 取挂载时刻值作 interpolate 定值参考系，tick 中不重算（避免全域重着色闪烁）
    const fillColor: DataDrivenPropertyValueSpecification<string> = [
      'case',
      ['has', 'value'],
      minValue === maxValue
        ? '#00d4ff'
        : ['interpolate', ['linear'], ['get', 'value'], minValue, '#1e3a5f', maxValue, '#00d4ff'],
      '#16213e',
    ]

    // setWorkerUrl 须在首个 new ml.Map 之前（worker 构建失败会走 error 兜底）
    ml.setWorkerUrl(workerUrl)

    try {
      map = new ml.Map({
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

    // 就绪回调（map 创建成功、load 前）：若 update 曾早于就绪到达，
    // 以 pending 值 snap 注入（无补间）并更新标签文本，保证首帧即最新数据。
    // 注：pending 在 update/fallback 闭包中赋值，此处断言绕过 TS 对捕获变量的 null 收窄
    if (pending) {
      const snap = pending as CountrySales[]
      injectAll(new Map(snap.map((c) => [c.iso3, c.value])))
      refreshLabelTexts(snap)
      pending = null
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
      if (!map) return // load 前补间 setData 可能因 source 未建而被吞，load 后强制同步一次
      ;(map.getSource('world') as GeoJSONSource | undefined)?.setData(geojson as FeatureCollection)
      for (const c of countries) {
        const el = labelEls.get(c.key)
        if (!el) continue
        const p = map.project([c.lng, c.lat])
        el.style.left = `${p.x}px`
        el.style.top = `${p.y}px`
      }
      applyDeclutter()
    })

    // 运行期错误（worker 失败、WebGL 上下文丢失等）：吞掉不冒泡 console，
    // 但若标签尚未定位（load 未触发）则降级到等距投影，保证标签可见
    map.on('error', () => {
      const first = labelEls.values().next().value as HTMLElement | undefined
      if (first && !first.style.left) fallback()
    })
  })().catch(() => {
    fallback()
  })

  // 补间：10 帧 rAF，起点为当前已注入值、终点为 targets；帧内检查 disposed，
  // 结束后 injected 收敛为终值
  function startTween(targets: CountrySales[]): void {
    if (!geojson) return
    cancelAnimationFrame(rafId)
    const seqs = targets.map((c) => tweenSteps(injected.get(c.iso3) ?? c.value, c.value, 10))
    let frame = 0
    const stepFrame = (): void => {
      if (disposed) return
      frame++
      for (const [k, c] of targets.entries()) injectValue(c.iso3, seqs[k][frame - 1])
      ;(map?.getSource('world') as GeoJSONSource | undefined)?.setData(geojson as FeatureCollection)
      if (frame < 10) {
        rafId = requestAnimationFrame(stepFrame)
      } else {
        for (const c of targets) injected.set(c.iso3, c.value)
      }
    }
    rafId = requestAnimationFrame(stepFrame)
  }

  return {
    dispose,
    update(cs: CountrySales[]): void {
      latest = new Map(cs.map((c) => [c.key, c.value]))
      refreshLabelTexts(cs)
      if (!map || !geojson) {
        pending = cs
        return
      }
      startTween(cs)
    },
  }
}
