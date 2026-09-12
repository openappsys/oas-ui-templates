<script lang="ts">
  // src/pages/settings/notification-tab.svelte —— 通知 Tab：3 类通知 × 2 渠道开关矩阵
  // 受控 checks state 防止 locale 切换等无关重渲染把开关打回挂载初值
  import { useT } from '../../lib/use-t.svelte'
  import { NOTIF_PREFIX, readBool } from '../../settings-init'

  const NOTIF_ROWS: Array<{ key: string; labelKey: string }> = [
    { key: 'orders', labelKey: 'settings.notif.orders' },
    { key: 'inventory', labelKey: 'settings.notif.inventory' },
    { key: 'system', labelKey: 'settings.notif.system' },
  ]
  const NOTIF_CHANNELS: Array<{ key: string; labelKey: string }> = [
    { key: 'inapp', labelKey: 'settings.notif.inapp' },
    { key: 'email', labelKey: 'settings.notif.email' },
  ]

  function readChecks(): Record<string, boolean> {
    const map: Record<string, boolean> = {}
    for (const row of NOTIF_ROWS) {
      for (const c of NOTIF_CHANNELS) {
        map[`${row.key}.${c.key}`] = readBool(`${NOTIF_PREFIX}${row.key}.${c.key}`, true)
      }
    }
    return map
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let checks = $state<Record<string, boolean>>(readChecks())
  let matrixEl = $state<HTMLDivElement | null>(null)

  // oas-change 在矩阵容器上委托：composedPath[0] 取实际变动的 switch，data-key 定位持久化键。
  // div 上 kebab 自定义事件走 addEventListener（模板直绑仅声明在 oas-* 组件标签上）
  $effect(() => {
    const el = matrixEl
    if (!el) return
    el.addEventListener('oas-change', onSwitchChange)
    return () => el.removeEventListener('oas-change', onSwitchChange)
  })

  // oas-change 在矩阵容器上委托：composedPath[0] 取实际变动的 switch，data-key 定位持久化键
  function onSwitchChange(e: Event): void {
    const sw = e.composedPath()[0] as HTMLElement
    const key = sw.getAttribute('data-key')
    if (!key) return
    const { checked } = (e as CustomEvent<{ checked: boolean }>).detail
    localStorage.setItem(NOTIF_PREFIX + key, String(checked))
    checks = { ...checks, [key]: checked }
  }
</script>

<div class="setting-group">
  <div class="setting-group-title">{tt('settings.notif.title')}</div>
  <div id="notif-matrix" class="notif-matrix" data-testid="notif-matrix" bind:this={matrixEl}>
    <div class="notif-row notif-head">
      <span>{tt('settings.notif.type')}</span>
      {#each NOTIF_CHANNELS as c (c.key)}
        <span class="notif-col">{tt(c.labelKey)}</span>
      {/each}
    </div>
    {#each NOTIF_ROWS as row (row.key)}
      <div class="notif-row">
        <span class="notif-channel">{tt(row.labelKey)}</span>
        {#each NOTIF_CHANNELS as c (c.key)}
          <span class="notif-col">
            <oas-switch
              data-testid={`notif-${row.key}-${c.key}`}
              data-key={`${row.key}.${c.key}`}
              checked={checks[`${row.key}.${c.key}`] ? '' : null}
            ></oas-switch>
          </span>
        {/each}
      </div>
    {/each}
  </div>
</div>
