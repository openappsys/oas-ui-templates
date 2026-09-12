<script lang="ts">
  // 占位页：orders（真实实现见后续任务；本任务仅接通路由）
  import { useT } from "../lib/use-t.svelte"

  const { t, locale } = useT()
  const title = $derived.by(() => {
    void $locale // 订阅 locale 变化触发文案重算
    return t("nav.orders")
  })
</script>

<div class="page">
  <div class="page-head">
    <h1 class="page-title">{title}</h1>
  </div>
</div>
