// oas-ui Web Components 的 JSX 类型声明：让 <oas-*> 标签在 React JSX 下通过 tsc 检查。
// 统一规则：
//   - 标量 prop 按 HTML 语义声明 string | boolean | number
//   - 数据型 prop（columns/data/options/rules/items）声明 string（JSON 序列化后传入）
//   - kebab-case 属性用引号键名，如 'row-key'
//   - onOasXxx 自定义事件声明仅供类型通过——React 19 不会把 onXxx prop 绑到 kebab 事件，
//     真实事件绑定必须用 useOasEvent（addEventListener），见 src/hooks/use-oas-event.ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type OasBase = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>

declare module 'react/jsx-runtime' {
  namespace JSX {
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
        onOasSubmit?: (e: Event) => void
        onOasValidateFail?: (e: Event) => void
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
        'no-footer'?: boolean
        onOasClose?: (e: Event) => void
        onOasOk?: (e: Event) => void
        onOasCancel?: (e: Event) => void
      }
      'oas-drawer': OasBase & {
        title?: string
        placement?: string
        size?: string
        open?: boolean
        visible?: boolean
        'no-footer'?: boolean
        onOasClose?: (e: Event) => void
        onOasOk?: (e: Event) => void
        onOasCancel?: (e: Event) => void
      }
      'oas-switch': OasBase & {
        name?: string
        label?: string
        checked?: boolean
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-layout': OasBase & {
        viewport?: boolean
        side?: string
      }
      'oas-sider': OasBase
      'oas-sidebar': OasBase & {
        items?: string
        active?: string
        collapsed?: boolean
        onOasSelect?: (e: Event) => void
        onOasCollapse?: (e: Event) => void
      }
      'oas-menubar': OasBase & {
        items?: string
        value?: string
        orientation?: string
        trigger?: string
        onOasSelect?: (e: Event) => void
      }
      'oas-navigation-menu': OasBase & {
        items?: string
        value?: string
        orientation?: string
        onOasSelect?: (e: Event) => void
      }
      'oas-tabs': OasBase & {
        active?: string
        type?: string
        'hide-content'?: boolean
        'context-menu'?: boolean
        onOasChange?: (e: Event) => void
        onOasClose?: (e: Event) => void
        onOasAdd?: (e: Event) => void
      }
      'oas-tab-panel': OasBase & {
        value?: string
      }
      'oas-breadcrumb': OasBase & {
        items?: string
      }
      'oas-command': OasBase & {
        items?: string
        open?: boolean
        hotkey?: string
        'close-on-select'?: string
        onOasSelect?: (e: Event) => void
        onOasOpenChange?: (e: Event) => void
      }
      'oas-badge': OasBase & {
        value?: string
        size?: string
        offset?: string
      }
      'oas-dropdown': OasBase & {
        items?: string
        value?: string
        placement?: string
        trigger?: string
        'arrow-point-at-center'?: boolean
        onOasSelect?: (e: Event) => void
      }
      'oas-avatar': OasBase & {
        size?: string | number
        text?: string
      }
      'oas-list': OasBase & {
        split?: boolean
      }
      'oas-list-item': OasBase & {
        title?: string
      }
    }
  }
}
