<script setup lang="ts">
// src/pages/result.vue —— 表单提交结果页（成功/失败双态，一次性读取 sessionStorage）
//    result-reset/result-back-form/result-actions）
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { appMessage, destroyAll } from '../lib/app-message'
import { useT } from '../composables/use-t'

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

<style scoped>
/* 结果页样式（自 app.css 迁入） */
.result-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.result-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.result-page oas-result::part(description) {
  font-family: var(--app-mono);
}
.result-actions {
  display: flex;
  gap: var(--oas-space-3);
  justify-content: center;
  margin-top: var(--oas-space-4);
}
</style>
