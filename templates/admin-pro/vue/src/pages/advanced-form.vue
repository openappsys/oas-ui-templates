<script setup lang="ts">
// src/pages/advanced-form.vue —— 高级表单：级联 / 联想 / 评分 / 标签 / 穿梭 / 树选择组合与校验
// 行为事实来源：vanilla-html/src/pages/advanced-form.ts（214 行，逐块对齐；
// react 版 Task 9 并行中仍为占位，以 vanilla 为准）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML 拼装 + refreshText 逐节点 setAttribute 回写；本模版声明式——
//    rules/options/data 等复杂数据全部 computed JSON 字符串（AGENTS.md 第 3 条），
//    useT() 订阅 locale 后整页重渲染即等价于 vanilla onLocaleChange(refreshText)
// 2. 事件绑定：oas-form 的 oas-submit 模板直绑（AGENTS.md 第 1 条，无需 react 版
//    useOasEvent 桥接）；提交/重置按钮原生 click 直绑 @click
// 3. 提交/重置仍走命令式：oas-form 内部 <form> 在 shadowRoot 里，
//    requestSubmit()/reset() 跨 shadow 调用（login.vue 同款 playground 实测模式）
// 4. formValues：vanilla 仅在 submit 时赋值后 void（无后续消费）；本模版同样留存不消费，
//    保持与 vanilla 的状态面一致
import { computed, ref } from 'vue'
import '../styles/pages/advanced-form.css'
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
// vanilla formValues：submit 后留存（无消费方，对齐 vanilla 状态面）
let formValues: Record<string, string> = {}

// 静态数据（vanilla render 时 advFormData() 取一次）
const data = advFormData()

// vanilla catOptions()/channelOptions()/rulesJSON()：随 locale 重算的 JSON attribute
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

// vanilla oas-submit 段
function onSubmit(e: Event): void {
  formValues = (e as CustomEvent<{ values: Record<string, string> }>).detail.values
  appMessage.success(tt('adv.submitted'))
}
// vanilla [data-action="reset"] 段
function onReset(): void {
  innerForm()?.reset()
  void formValues
  appMessage.info(tt('basic.resetDone'))
}
// vanilla [data-action="submit"] 段
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
