<script setup lang="ts">
// src/pages/forbidden.vue —— 403 无权访问页
// 行为事实来源：vanilla-html/src/pages/forbidden.ts（react 版 Task 9 并行中，以 vanilla 为准）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML + querySelector 绑监听；本模版声明式模板 + @click 直绑
// 2. 导航：vanilla 自研路由 navigate('/dashboard')；本模版 vue-router push（壳层同款）
// 3. 文案刷新：vanilla onLocaleChange(draw) 整页重绘；本模版 useT() 订阅 locale 后重渲染
import { useRouter } from 'vue-router'
import { useT } from '../composables/use-t'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string): string {
  void locale.value
  return tt(key)
}

const router = useRouter()

function goHome(): void {
  void router.push('/dashboard')
}
// vanilla：有历史则后退，否则回首页
function goBack(): void {
  if (history.length > 1) history.back()
  else void router.push('/dashboard')
}
</script>

<template>
  <div class="page notice">
    <oas-icon class="notice-icon notice-icon--lock" name="lock" size="28" />
    <div class="notice-code">403</div>
    <h1 class="notice-title">{{ t('common.403.title') }}</h1>
    <p class="notice-desc">{{ t('common.403.desc') }}</p>
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
