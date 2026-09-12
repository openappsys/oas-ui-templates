// src/app.d.ts —— Svelte 全局类型声明
// oas-ui Web Components 的 svelteHTML.IntrinsicElements 声明：让 <oas-*> 标签通过 svelte-check。
// 先声明 12 个基础标签（对齐 react 版 elements.d.ts 前 12 个），后续任务按需补充。
// 统一规则（spike 实测结论，见计划 Global Constraints）：
//   - 标量 prop 按 HTML 语义声明 string | boolean | number
//   - 数据型 prop（options/rules/items 等）声明 string（JSON 序列化后传入）
//   - 布尔 attribute 存在性语义：模板写 {cond ? '' : null}（null 整属性省略）
//   - kebab-case 属性用引号键名；oas-* 自定义事件模板直绑 onoas-xxx={handler}（Svelte 5 原生支持）
import type { HTMLAttributes } from 'svelte/elements'

type OasBase = HTMLAttributes<HTMLElement>

declare global {
  namespace svelteHTML {
    interface IntrinsicElements {
      'oas-button': OasBase & {
        type?: string
        size?: string
        variant?: string
        icon?: string
        loading?: boolean
        disabled?: boolean
        block?: boolean
      }
      'oas-icon': OasBase & {
        name?: string
        size?: string | number
      }
      'oas-input': OasBase & {
        name?: string
        value?: string
        type?: string
        label?: string
        placeholder?: string
        prefix?: string
        suffix?: string
        'prefix-icon'?: string
        clearable?: boolean
        required?: boolean
        disabled?: boolean
        readonly?: boolean
      }
      'oas-select': OasBase & {
        name?: string
        options?: string
        value?: string
        label?: string
        placeholder?: string
        clearable?: boolean
        disabled?: boolean
      }
      'oas-form': OasBase & {
        rules?: string
        inline?: boolean
        layout?: string
        'onoas-submit'?: (e: Event) => void
        'onoas-validate-fail'?: (e: Event) => void
      }
      'oas-form-item': OasBase & {
        label?: string
        name?: string
        required?: boolean
      }
      'oas-card': OasBase & {
        title?: string
      }
      'oas-tag': OasBase & {
        type?: string
        size?: string
      }
      'oas-space': OasBase & {
        direction?: string
        justify?: string
        align?: string
        size?: string | number
        wrap?: boolean
      }
      'oas-modal': OasBase & {
        title?: string
        open?: boolean
        visible?: boolean
        'no-footer'?: boolean
        'onoas-close'?: (e: Event) => void
        'onoas-ok'?: (e: Event) => void
        'onoas-cancel'?: (e: Event) => void
      }
      'oas-drawer': OasBase & {
        title?: string
        placement?: string
        size?: string
        open?: boolean
        visible?: boolean
        'no-footer'?: boolean
        'onoas-close'?: (e: Event) => void
        'onoas-ok'?: (e: Event) => void
        'onoas-cancel'?: (e: Event) => void
      }
      'oas-switch': OasBase & {
        name?: string
        label?: string
        checked?: boolean
        disabled?: boolean
        'onoas-change'?: (e: Event) => void
      }
    }
  }
}

export {}
