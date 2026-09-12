// src/app.d.ts —— Svelte 全局类型声明
// oas-ui Web Components 的 svelteHTML.IntrinsicElements 声明：让 <oas-*> 标签通过 svelte-check。
// 统一规则（spike 实测结论，见计划 Global Constraints）：
//   - 标量 prop 按 HTML 语义声明 string | boolean | number
//   - 数据型 prop（options/rules/items 等）声明 string（JSON 序列化后传入）
//   - 布尔 attribute 存在性语义：模板写 {cond ? '' : null}（null 整属性省略），
//     故此类属性类型带 string | null（'' 为存在、null 为移除）
//   - kebab-case 属性用引号键名；oas-* 自定义事件模板直绑 onoas-xxx={handler}（Svelte 5 原生支持）
import type { HTMLAttributes } from 'svelte/elements'

type OasBase = HTMLAttributes<HTMLElement>

/** 存在性语义的布尔属性：'' → 开启，null → 移除 */
type OasFlag = string | boolean | null

type OasEvent = (e: Event) => void

declare global {
  namespace svelteHTML {
    interface IntrinsicElements {
      'oas-button': OasBase & {
        type?: string
        size?: string
        variant?: string
        icon?: string
        loading?: boolean
        // 存在性语义：组件基类纯 attribute 驱动（无 property setter），传 false 会落成
        // disabled="false" 仍被判定禁用——必须用 {cond ? '' : null}
        disabled?: OasFlag
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
        /** Enter 键派发（bubbles+composed，登录页跨版式直绑） */
        'onoas-enter'?: OasEvent
        'onoas-input'?: OasEvent
        'onoas-clear'?: OasEvent
      }
      'oas-select': OasBase & {
        name?: string
        options?: string
        value?: string
        label?: string
        placeholder?: string
        clearable?: boolean
        disabled?: boolean
        'onoas-change'?: OasEvent
      }
      'oas-form': OasBase & {
        rules?: string
        inline?: boolean
        layout?: string
        'onoas-submit'?: OasEvent
        'onoas-validate-fail'?: OasEvent
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
        color?: string
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
        open?: OasFlag
        visible?: OasFlag
        'no-footer'?: OasFlag
        'onoas-close'?: OasEvent
        'onoas-ok'?: OasEvent
        'onoas-cancel'?: OasEvent
        // light DOM 子元素（如列设置 checkbox）的 oas-change 冒泡到 host 的委托监听
        'onoas-change'?: OasEvent
      }
      'oas-drawer': OasBase & {
        title?: string
        placement?: string
        size?: string
        open?: OasFlag
        visible?: OasFlag
        'no-footer'?: OasFlag
        'onoas-close'?: OasEvent
        'onoas-ok'?: OasEvent
        'onoas-cancel'?: OasEvent
      }
      'oas-switch': OasBase & {
        name?: string
        label?: string
        checked?: OasFlag
        disabled?: boolean
        'onoas-change'?: OasEvent
      }
      // ---- Task 2：布局壳 + 设置中心 ----
      'oas-layout': OasBase & {
        viewport?: OasFlag
        side?: string
      }
      'oas-sider': OasBase
      'oas-sidebar': OasBase & {
        items?: string
        active?: string
        collapsed?: OasFlag
        'onoas-select'?: OasEvent
        'onoas-collapse'?: OasEvent
      }
      'oas-menubar': OasBase & {
        orientation?: string
        trigger?: string | null
        items?: string
        value?: string
        'onoas-select'?: OasEvent
      }
      'oas-navigation-menu': OasBase & {
        orientation?: string
        items?: string
        'onoas-select'?: OasEvent
      }
      'oas-breadcrumb': OasBase & {
        items?: string
      }
      'oas-tabs': OasBase & {
        type?: string
        active?: string
        'hide-content'?: OasFlag
        'context-menu'?: OasFlag
        'tab-position'?: string | null
        'onoas-change'?: OasEvent
        'onoas-close'?: OasEvent
        'onoas-add'?: OasEvent
      }
      'oas-tab-panel': OasBase & {
        value?: string
        label?: string
        badge?: string | number | null
      }
      'oas-dropdown': OasBase & {
        placement?: string
        trigger?: string
        value?: string
        items?: string
        'arrow-point-at-center'?: OasFlag
        'onoas-select'?: OasEvent
      }
      'oas-badge': OasBase & {
        value?: string
        size?: string
        offset?: string
      }
      'oas-avatar': OasBase & {
        size?: string | number
        text?: string
      }
      'oas-list': OasBase & {
        split?: OasFlag
      }
      'oas-list-item': OasBase & {
        title?: string
      }
      'oas-command': OasBase & {
        hotkey?: string
        items?: string
        open?: OasFlag
        'close-on-select'?: string
        'onoas-open-change'?: OasEvent
        'onoas-select'?: OasEvent
      }
      'oas-segmented': OasBase & {
        options?: string
        value?: string
        'onoas-change'?: OasEvent
      }
      'oas-color-picker': OasBase & {
        value?: string
        'onoas-change'?: OasEvent
      }
      'oas-slider': OasBase & {
        min?: string | number
        max?: string | number
        step?: string | number
        value?: string | number
        'onoas-change'?: OasEvent
      }
      'oas-radio': OasBase & {
        name?: string
        value?: string
        checked?: OasFlag
        disabled?: boolean
      }
      'oas-theme-editor': OasBase & {
        'onoas-change'?: OasEvent
      }
      // ---- Task 5：orders / order-detail / result / category / logs ----
      // oas-table 为 Task 4/5 两批次用法的并集（合并去重，勿再整块覆盖他人成员）
      'oas-table': OasBase & {
        'row-key'?: string
        'empty-text'?: string
        data?: string
        checkable?: OasFlag
        stripe?: OasFlag
        editable?: OasFlag
        loading?: OasFlag
        pagination?: OasFlag
        'page-size'?: string | number
        'column-keys'?: string
        current?: string | number
        'filter-values'?: string
        'onoas-check'?: OasEvent
        'onoas-edit'?: OasEvent
        'onoas-change'?: OasEvent
        'onoas-row-click'?: OasEvent
        'onoas-ok'?: OasEvent
      }
      'oas-progress': OasBase & {
        percent?: string | number
        'show-text'?: OasFlag
      }
      'oas-result': OasBase & {
        status?: string
        title?: string
        description?: string
      }
      'oas-steps': OasBase & {
        steps?: string
        current?: string | number
      }
      'oas-timeline-item': OasBase & {
        time?: string
        color?: string
      }
      'oas-anchor': OasBase & {
        direction?: string
        hash?: string
        items?: string
        active?: string | null
        'onoas-click'?: OasEvent
      }
      'oas-virtual-list': OasBase & {
        height?: string | number
        'item-height'?: string | number
        'onoas-item'?: OasEvent
        'onoas-scroll'?: OasEvent
      }
      // 其余 oas-* 标签：宽松基座声明（用到再按 props 细化）
      'oas-auto-complete': OasBase
      'oas-cascader': OasBase
      // ---- Task 3：login / dashboard（自宽松基座细化）----
      'oas-chart': OasBase & {
        type?: string
      }
      'oas-skeleton': OasBase & {
        active?: OasFlag
        rows?: string | number
      }
      'oas-checkbox-group': OasBase
      'oas-combobox': OasBase
      'oas-divider': OasBase
      'oas-dynamic-tags': OasBase
      // ---- Task 4：products/users/profile/错误页（自宽松基座细化，属性见各页面用法） ----
      'oas-masonry': OasBase & {
        columns?: string
        gap?: string
        'onoas-change'?: OasEvent
      }
      'oas-empty': OasBase & {
        description?: string
      }
      'oas-input-number': OasBase & {
        name?: string
        value?: string
        min?: string | number
        max?: string | number
        step?: string | number
        precision?: string
        placeholder?: string
        disabled?: boolean
      }
      'oas-date-picker': OasBase & {
        type?: string
        value?: string
        placeholder?: string
        disabled?: boolean
        'onoas-change'?: OasEvent
      }
      'oas-descriptions': OasBase & {
        column?: string | number
      }
      'oas-descriptions-item': OasBase & {
        label?: string
      }
      'oas-page-header': OasBase & {
        title?: string
      }
      'oas-pagination': OasBase & {
        total?: string | number
        'page-size'?: string | number
        current?: string | number
        'show-total'?: OasFlag
        'onoas-change'?: OasEvent
      }
      'oas-popconfirm': OasBase & {
        title?: string
        placement?: string
        'onoas-ok'?: OasEvent
        'onoas-cancel'?: OasEvent
      }
      'oas-upload': OasBase & {
        accept?: string
        'list-type'?: string
        disabled?: boolean
      }
      'oas-checkbox': OasBase & {
        value?: string
        checked?: OasFlag
        disabled?: OasFlag
        'onoas-change'?: OasEvent
      }
      'oas-number-animation': OasBase
      'oas-pin-input': OasBase
      'oas-rate': OasBase
      'oas-splitter': OasBase
      'oas-statistic': OasBase
      'oas-textarea': OasBase
      'oas-timeline': OasBase
      'oas-tree': OasBase
      'oas-tree-select': OasBase
      'oas-transfer': OasBase
      'oas-watermark': OasBase

    }
  }
}

export {}
