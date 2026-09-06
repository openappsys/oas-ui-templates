<!-- src/pages/server-error.vue —— 500 服务器错误示例页 -->
<!-- 行为事实来源：vanilla-html/src/pages/server-error.ts；对齐参照：react 版 server-error.tsx。
     偏差记录（因果链）：
     1. 路由：vanilla 自研 navigate()；本模版用 vue-router 的 router.push/back，
        回退逻辑（history.length > 1 → back，否则去 /dashboard）逐字保留
     2. 文案刷新：vanilla onLocaleChange(draw) 整体重绘；本模版 useT() 建立响应式依赖后自动重渲染
     3. 事件：两个按钮均为 light DOM 原生 click，模板 @click 直绑 -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useT } from '../composables/use-t'

const { t } = useT()
const router = useRouter()
const goHome = () => router.push('/dashboard')
const goBack = () => {
  if (history.length > 1) history.back()
  else router.push('/dashboard')
}
</script>

<template>
  <div class="page notice">
    <oas-icon class="notice-icon notice-icon--error" name="error" size="28" />
    <div class="notice-code">500</div>
    <h1 class="notice-title">{{ t('common.500.title') }}</h1>
    <p class="notice-desc">{{ t('common.500.desc') }}</p>
    <div class="notice-actions">
      <oas-button type="default" variant="outlined" data-action="back" @click="goBack">
        {{ t('common.back') }}
      </oas-button>
      <oas-button type="primary" data-action="home" @click="goHome">
        {{ t('common.home') }}
      </oas-button>
    </div>
  </div>
</template>
