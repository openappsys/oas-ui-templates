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
