<script setup lang="ts">
// src/pages/basic-form.vue —— 基础表单：输入/下拉/数字/文本域/开关/日期/上传组合
// 行为事实来源：vanilla-html/src/pages/basic-form.ts（150 行，逐块对齐）；
// react 版同期并行开发中仍为占位，以 vanilla 为准
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML 拼装 + refreshText 逐节点 setAttribute 回写；本模版声明式——
//    rules/options 等复杂数据全部 computed JSON 字符串（AGENTS.md 第 3 条），useT() 订阅
//    locale 后整页重渲染即等价于 vanilla onLocaleChange(refreshText)
// 2. 事件绑定：oas-form 的 oas-submit 模板直绑（AGENTS.md 第 1 条）；提交/重置按钮原生
//    click 直绑 @click
// 3. 提交/重置仍走命令式：oas-form 内部 <form> 在 shadowRoot 里，requestSubmit()/reset()
//    跨 shadow 调用（advanced-form.vue 同款模式）
import { computed, ref } from 'vue'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const formRef = ref<HTMLElement | null>(null)

// vanilla catOptions()：随 locale 重算的 JSON attribute
const catOptions = computed(() =>
  JSON.stringify([
    { label: t('basic.catWeb'), value: 'web' },
    { label: t('basic.catMobile'), value: 'mobile' },
    { label: t('basic.catData'), value: 'data' },
  ]),
)
// vanilla statusOptions()
const statusOptions = computed(() =>
  JSON.stringify([
    { label: t('basic.stDev'), value: 'dev' },
    { label: t('basic.stLive'), value: 'live' },
  ]),
)
// vanilla rulesJSON()
const rules = computed(() =>
  JSON.stringify({
    name: [{ required: true, message: t('basic.ruleName') }],
    category: [{ required: true, message: t('basic.ruleCategory') }],
    contact: [
      { required: true, message: t('basic.ruleEmail') },
      { pattern: '^\\S+@\\S+$', message: t('basic.ruleEmailFmt') },
    ],
  }),
)

/** 跨 shadow 取 oas-form 内部原生 form */
function innerForm(): HTMLFormElement | null {
  return formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
}

// vanilla oas-submit 段
function onSubmit(): void {
  appMessage.success(t('basic.submitted'))
}
// vanilla [data-action="reset"] 段
function onReset(): void {
  innerForm()?.reset()
  appMessage.info(t('basic.resetDone'))
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
        <h1 class="page-title">{{ t('basic.title') }}</h1>
        <p class="page-subtitle">{{ t('basic.subtitle') }}</p>
      </div>
    </div>
    <oas-card class="list-card" :title="t('basic.card')">
      <oas-form id="basic-form" ref="formRef" :rules="rules" @oas-submit="onSubmit">
        <div class="form-grid form-grid--2col">
          <oas-input name="name" :label="t('basic.name')" :placeholder="t('basic.name')" />
          <oas-select
            name="category"
            :label="t('basic.category')"
            :options="catOptions"
            :placeholder="t('basic.category')"
          />
          <oas-select
            name="status"
            :label="t('basic.status')"
            :options="statusOptions"
            :placeholder="t('basic.status')"
          />
          <oas-input name="days" type="number" :label="t('basic.days')" />
          <oas-input name="budget" type="number" :label="t('basic.budget')" />
          <oas-input name="contact" :label="t('basic.contact')" :placeholder="t('basic.contact')" />
          <oas-textarea name="desc" :label="t('basic.desc')" />
          <oas-switch name="notify" :label="t('basic.notify')" />
          <oas-date-picker name="due" :label="t('basic.days')" />
          <oas-upload name="file" :label="t('basic.contact')" />
        </div>
        <oas-space>
          <oas-button type="primary" data-action="submit" @click="onSubmitClick">
            {{ t('basic.submit') }}
          </oas-button>
          <oas-button data-action="reset" @click="onReset">{{ t('basic.reset') }}</oas-button>
        </oas-space>
      </oas-form>
    </oas-card>
  </div>
</template>
