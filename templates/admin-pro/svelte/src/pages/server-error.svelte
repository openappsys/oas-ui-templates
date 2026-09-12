<script lang="ts">
  // src/pages/server-error.svelte —— 500 服务器错误示例页
  // 事件：两个按钮均为 light DOM 原生 click，模板直绑 onclick；回退逻辑
  // （history.length > 1 → back，否则去 /dashboard）逐字保留
  import { navigate } from '../router'
  import { useT } from '../lib/use-t.svelte'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  function goHome(): void {
    navigate('/dashboard')
  }
  function goBack(): void {
    if (history.length > 1) history.back()
    else navigate('/dashboard')
  }
</script>

<div class="page notice">
  <oas-icon class="notice-icon notice-icon--error" name="error" size="28"></oas-icon>
  <div class="notice-code">500</div>
  <h1 class="notice-title">{tt('common.500.title')}</h1>
  <p class="notice-desc">{tt('common.500.desc')}</p>
  <div class="notice-actions">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button type="default" variant="outlined" data-action="back" onclick={goBack}>
      {tt('common.back')}
    </oas-button>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button type="primary" data-action="home" onclick={goHome}>
      {tt('common.home')}
    </oas-button>
  </div>
</div>
