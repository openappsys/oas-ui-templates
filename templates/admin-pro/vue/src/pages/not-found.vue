<script setup lang="ts">
// src/pages/not-found.vue —— 404 页面不存在
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
function goBack(): void {
  if (history.length > 1) history.back()
  else void router.push('/dashboard')
}
</script>

<template>
  <div class="page notice">
    <oas-icon class="notice-icon notice-icon--search" name="search" size="28" />
    <div class="notice-code">404</div>
    <h1 class="notice-title">{{ t('common.404.title') }}</h1>
    <p class="notice-desc">{{ t('common.404.desc') }}</p>
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
