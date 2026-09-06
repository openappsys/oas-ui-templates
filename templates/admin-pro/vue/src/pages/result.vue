<script setup lang="ts">
// src/pages/result.vue —— 表单提交结果页（成功/失败双态，一次性读取 sessionStorage）
// 行为事实来源：vanilla-html/src/pages/result.ts（75 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 按成功/失败分支拼两份 innerHTML；本模版同一结构 + status/description
//    按态派生（DOM/类名/testid 与 vanilla 逐字一致：form-result/result-view-order/
//    result-reset/result-back-form/result-actions）
// 2. form-result 数据：写入方为 vanilla/form 页（本模版 /form 属后续任务）；直达 /result 时
//    读不到数据 → 失败态，与 vanilla 直达行为一致
// 3. 导航：vanilla navigate(path)；本模版 router.push（vue-router 通道）
// 4. destroyAll：vanilla render 时清残留 message；本模版从 app-message 取同一导出（setup 执行）
// 5. 文案刷新：vanilla onLocaleChange(refreshText) 逐属性替换；本模版 useT() 订阅后整页重渲染
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { appMessage, destroyAll } from '../lib/app-message'
import { useT } from '../composables/use-t'

// vanilla render 同步段：进入即清残留 toast，读一次 form-result 后立刻移除（防回退复用）
destroyAll()
const success = ref(false)
const orderId = ref('')
try {
  const raw = sessionStorage.getItem('form-result')
  if (raw) {
    const data = JSON.parse(raw) as { status?: string; orderId?: string }
    success.value = data.status === 'success'
    orderId.value = data.orderId ?? ''
  }
} catch {
  success.value = false
}
sessionStorage.removeItem('form-result')

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const router = useRouter()

// vanilla nav 段：查看订单 → /orders；再建一单/返回表单 → /form
function go(path: string): void {
  void router.push(path)
}
</script>

<template>
  <div class="page result-page">
    <div class="result-wrap">
      <oas-result
        data-testid="form-result"
        :status="success ? 'success' : 'error'"
        :title="success ? t('result.success.title') : t('result.error.title')"
        :description="
          success ? t('result.success.desc', { orderId }) : t('result.error.desc')
        "
      >
        <div slot="extra" class="result-actions">
          <template v-if="success">
            <oas-button data-testid="result-view-order" type="primary" @click="go('/orders')">
              {{ t('result.viewOrder') }}
            </oas-button>
            <oas-button data-testid="result-reset" @click="go('/form')">
              {{ t('result.createAnother') }}
            </oas-button>
          </template>
          <template v-else>
            <oas-button data-testid="result-back-form" type="primary" @click="go('/form')">
              {{ t('result.backForm') }}
            </oas-button>
          </template>
        </div>
      </oas-result>
    </div>
  </div>
</template>
