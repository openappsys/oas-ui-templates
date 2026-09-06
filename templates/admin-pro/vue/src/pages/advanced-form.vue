<script setup lang="ts">
// src/pages/advanced-form.vue —— 高级表单：级联 / 联想 / 评分 / 标签 / 穿梭 / 树选择组合与校验
// 2. 事件绑定：oas-form 的 oas-submit 模板直绑无需 react 版
//    useOasEvent 桥接）；提交/重置按钮原生 click 直绑 @click
// 3. 提交/重置仍走命令式：oas-form 内部 <form> 在 shadowRoot 里，
//    requestSubmit()/reset() 跨 shadow 调用（login.vue 同款 playground 实测模式）
import { computed, ref } from 'vue'
import { advFormData } from '../data/adv-form'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const formRef = ref<HTMLElement | null>(null)
let formValues: Record<string, string> = {}

const data = advFormData()

const catOptions = computed(() =>
  JSON.stringify([
    { label: t('adv.cat.electronics'), value: 'electronics' },
    { label: t('adv.cat.packaging'), value: 'packaging' },
    { label: t('adv.cat.chemical'), value: 'chemical' },
    { label: t('adv.cat.hardware'), value: 'hardware' },
  ]),
)
const channelData = computed(() =>
  JSON.stringify([
    { key: 'online', label: t('adv.channel.online') },
    { key: 'site', label: t('adv.channel.site') },
    { key: 'jd', label: t('adv.channel.jd') },
    { key: 'offline', label: t('adv.channel.offline') },
    { key: 'dealer', label: t('adv.channel.dealer') },
  ]),
)
const rules = computed(() =>
  JSON.stringify({
    company: [{ required: true, message: t('adv.ruleCompany') }],
    creditCode: [
      { required: true, message: t('adv.ruleCode') },
      { pattern: '^[0-9A-Z]{18}$', message: t('adv.ruleCodeFmt') },
    ],
    category: [{ required: true, message: t('adv.ruleCategory') }],
  }),
)
const phoneOptions = JSON.stringify(data.phones)
const regionOptions = JSON.stringify(data.regions)
const treeRegionOptions = JSON.stringify(data.treeRegions)

/** 跨 shadow 取 oas-form 内部原生 form */
function innerForm(): HTMLFormElement | null {
  return formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
}

function onSubmit(e: Event): void {
  formValues = (e as CustomEvent<{ values: Record<string, string> }>).detail.values
  appMessage.success(tt('adv.submitted'))
}
function onReset(): void {
  innerForm()?.reset()
  void formValues
  appMessage.info(tt('basic.resetDone'))
}
function onSubmitClick(): void {
  innerForm()?.requestSubmit()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('adv.title') }}</h1>
        <p class="page-subtitle">{{ t('adv.subtitle') }}</p>
      </div>
    </div>
    <oas-form id="advanced-form" ref="formRef" :rules="rules" layout="vertical" @oas-submit="onSubmit">
      <oas-card class="adv-card" :title="t('adv.basic')">
        <div class="adv-grid">
          <oas-form-item :label="t('adv.company')" required>
            <oas-input name="company" :placeholder="t('adv.companyPh')" />
          </oas-form-item>
          <oas-form-item :label="t('adv.creditCode')" required>
            <oas-input name="creditCode" :placeholder="t('adv.creditCodePh')" />
          </oas-form-item>
          <oas-form-item :label="t('adv.founded')">
            <oas-date-picker :placeholder="t('adv.foundedPh')" />
          </oas-form-item>
          <oas-form-item :label="t('adv.staff')">
            <oas-slider name="staff" min="0" max="5000" step="100" value="200" data-testid="adv-staff" />
          </oas-form-item>
        </div>
      </oas-card>
      <oas-card class="adv-card" :title="t('adv.contact')">
        <div class="adv-grid">
          <oas-form-item :label="t('adv.phone')">
            <oas-auto-complete name="phone" :placeholder="t('adv.phonePh')" :options="phoneOptions" />
          </oas-form-item>
          <oas-form-item :label="t('adv.address')">
            <oas-cascader :placeholder="t('adv.addressPh')" :options="regionOptions" />
          </oas-form-item>
          <oas-form-item :label="t('adv.pinLabel')">
            <oas-pin-input name="pin" length="4" data-testid="adv-pin" />
          </oas-form-item>
          <oas-form-item :label="t('adv.email')">
            <oas-input name="email" type="email" :placeholder="t('adv.emailPh')" />
          </oas-form-item>
        </div>
      </oas-card>
      <oas-card class="adv-card" :title="t('adv.biztitle')">
        <div class="adv-grid">
          <oas-form-item :label="t('adv.category')" required>
            <oas-combobox name="category" :placeholder="t('adv.categoryPh')" :options="catOptions" />
          </oas-form-item>
          <oas-form-item :label="t('adv.rating')">
            <oas-rate name="rating" value="3" data-testid="adv-rating" />
          </oas-form-item>
          <oas-form-item :label="t('adv.tags')">
            <oas-dynamic-tags name="tags" :placeholder="t('adv.tagsPh')" data-testid="adv-tags" />
          </oas-form-item>
          <oas-form-item :label="t('adv.region')">
            <oas-tree-select :placeholder="t('adv.regionPh')" :options="treeRegionOptions" />
          </oas-form-item>
        </div>
      </oas-card>
      <oas-card class="adv-card" :title="t('adv.coop')">
        <div class="adv-grid">
          <oas-form-item :label="t('adv.channels')">
            <oas-transfer data-testid="adv-transfer" :data="channelData" />
          </oas-form-item>
          <oas-form-item :label="t('adv.notify')">
            <oas-switch />
          </oas-form-item>
        </div>
      </oas-card>
      <oas-space>
        <oas-button type="primary" data-action="submit" @click="onSubmitClick">
          {{ t('adv.submit') }}
        </oas-button>
        <oas-button data-action="reset" @click="onReset">{{ t('basic.reset') }}</oas-button>
      </oas-space>
    </oas-form>
  </div>
</template>

<style scoped>
/* 高级表单样式（自 advanced-form.css 迁入） */
.adv-card {
  margin-bottom: var(--oas-space-4);
}
.adv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oas-space-4);
}
@media (max-width: 640px) {
  .adv-grid {
    grid-template-columns: 1fr;
  }
}
</style>
