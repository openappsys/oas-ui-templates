<script lang="ts">
  // src/pages/result.svelte —— 表单结果页（成功/失败双态，sessionStorage 快照驱动）
  // 对齐 react 版 result.tsx：挂载时一次性读取并消费 sessionStorage('form-result')
  // （form 页提交成功/失败时写入），快照在初始化时固化，重渲染只换文案；
  // 进入结果页时 destroyAll 清空遗留消息。
  import '../styles/pages/result.css'
  import { destroyAll } from '@oas-ui/ui/feedback/message'
  import { useT } from '../lib/use-t.svelte'
  import { navigate } from '../router'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  interface FormResult {
    success: boolean
    orderId: string
  }

  function consumeFormResult(): FormResult {
    let success = false
    let orderId = ''
    try {
      const raw = sessionStorage.getItem('form-result')
      if (raw) {
        const data = JSON.parse(raw) as { status?: string; orderId?: string }
        success = data.status === 'success'
        orderId = data.orderId ?? ''
      }
    } catch {
      success = false
    }
    sessionStorage.removeItem('form-result')
    return { success, orderId }
  }

  // 快照初始化时固化（组件按 pageKey 重挂载即取新快照）
  const result = consumeFormResult()

  // 进入结果页时清空遗留消息（react 版 useEffect destroyAll 同款）
  destroyAll()

  function goOrders(): void {
    navigate('/orders')
  }
  function goForm(): void {
    navigate('/form')
  }

  let successEl: HTMLElement | null = $state(null)
  let errorEl: HTMLElement | null = $state(null)
  // title 命中 HTMLElement.prototype.title，oas-* 元素上的 title 必须走 setAttribute 通道
  $effect(() => {
    successEl?.setAttribute('title', tt('result.success.title'))
    errorEl?.setAttribute('title', tt('result.error.title'))
  })
</script>

<div class="page result-page">
  <div class="result-wrap">
    {#if result.success}
      <oas-result
        bind:this={successEl}
        data-testid="form-result"
        status="success"
        description={tt('result.success.desc', { orderId: result.orderId })}
      >
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-view-order" type="primary" onclick={goOrders}>
            {tt('result.viewOrder')}
          </oas-button>
          <oas-button data-testid="result-reset" onclick={goForm}>
            {tt('result.createAnother')}
          </oas-button>
        </div>
      </oas-result>
    {:else}
      <oas-result
        bind:this={errorEl}
        data-testid="form-result"
        status="error"
        description={tt('result.error.desc')}
      >
        <div slot="extra" class="result-actions">
          <oas-button data-testid="result-back-form" type="primary" onclick={goForm}>
            {tt('result.backForm')}
          </oas-button>
        </div>
      </oas-result>
    {/if}
  </div>
</div>
