// oas-ui Web Components 的 JSX 类型声明：让 <oas-*> 标签在 React JSX 下通过 tsc 检查。
// 统一规则：
//   - 标量 prop 按 HTML 语义声明 string | boolean | number
//   - 数据型 prop（columns/data/options/rules/items）声明 string（JSON 序列化后传入）；
//     例外：oas-table 的 columns/data 支持 property 通道（render 函数无法 JSON 序列化，
//     React 19 对自定义元素上已定义的 property 会直接赋值，见 src/pages/products-table.tsx）
//   - kebab-case 属性用引号键名，如 'row-key'
//   - onOasXxx 自定义事件声明仅供类型通过——React 19 不会把 onXxx prop 绑到 kebab 事件，
//     真实事件绑定必须用 useOasEvent（addEventListener），见 src/hooks/use-oas-event.ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'

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
        visible?: boolean
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
      'oas-radio': OasBase & {
        name?: string
        value?: string
        checked?: boolean
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-color-picker': OasBase & {
        value?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-slider': OasBase & {
        name?: string
        min?: string | number
        max?: string | number
        step?: string | number
        value?: string | number
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-segmented': OasBase & {
        options?: string
        value?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-theme-editor': OasBase & {
        token?: string
        preset?: string
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
        'tab-position'?: string
        'hide-content'?: boolean
        'context-menu'?: boolean
        onOasChange?: (e: Event) => void
        onOasClose?: (e: Event) => void
        onOasAdd?: (e: Event) => void
      }
      'oas-tab-panel': OasBase & {
        value?: string
        label?: string
        badge?: string | number
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
      'oas-chart': OasBase & {
        type?: string
        /** 图表数据（JSON 字符串；React 19 对自定义元素上存在的 property 会走 property 通道，两通道组件均支持） */
        data?: string
        options?: string
      }
      'oas-skeleton': OasBase & {
        active?: boolean
        rows?: string | number
      }
      'oas-empty': OasBase & {
        description?: string
      }
      'oas-table': OasBase & {
        /** 列定义：JSON 字符串或 TableColumn[]（含 render 函数时走 property 通道） */
        columns?: string | TableColumn[]
        /** 行数据：JSON 字符串或对象数组（property 通道） */
        data?: string | object[]
        'row-key'?: string
        'column-keys'?: string
        checkable?: boolean
        stripe?: boolean
        editable?: boolean
        pagination?: boolean
        'page-size'?: string | number
        current?: string | number
        loading?: boolean
        onOasSortChange?: (e: Event) => void
      }
      'oas-masonry': OasBase & {
        columns?: string | number
        gap?: string
      }
      'oas-pagination': OasBase & {
        total?: string | number
        'page-size'?: string | number
        current?: string | number
        'show-total'?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-checkbox': OasBase & {
        name?: string
        value?: string
        checked?: boolean
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-popconfirm': OasBase & {
        title?: string
        onOasOk?: (e: Event) => void
        onOasCancel?: (e: Event) => void
      }
      'oas-input-number': OasBase & {
        name?: string
        value?: string | number
        min?: string | number
        max?: string | number
        step?: string | number
        precision?: string | number
        placeholder?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-date-picker': OasBase & {
        name?: string
        value?: string
        /** 日期选择器形态（single/daterange 等，logs 页 daterange 在用） */
        type?: string
        placeholder?: string
        /** 可选最早日期（YYYY-MM-DD，form 向导页在用） */
        min?: string
        /** vanilla basic-form 页原样写入的属性（组件当前不渲染 label，仅为 DOM 对齐） */
        label?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-upload': OasBase & {
        name?: string
        accept?: string
        'list-type'?: string
        /** vanilla basic-form 页原样写入的属性（组件当前不渲染 label，仅为 DOM 对齐） */
        label?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-page-header': OasBase & {
        title?: string
        subtitle?: string
      }
      'oas-progress': OasBase & {
        percent?: string | number
        /** vanilla data-board 页原样使用的属性名（组件当前读取 percent，此处仅为 DOM 对齐） */
        value?: string | number
        'show-text'?: string | boolean
        status?: string
      }
      'oas-auto-complete': OasBase & {
        name?: string
        value?: string
        options?: string
        placeholder?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-cascader': OasBase & {
        name?: string
        value?: string
        options?: string
        placeholder?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-combobox': OasBase & {
        name?: string
        value?: string
        options?: string
        placeholder?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-tree-select': OasBase & {
        name?: string
        value?: string
        options?: string
        placeholder?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-transfer': OasBase & {
        data?: string
        value?: string
        'source-title'?: string
        'target-title'?: string
        searchable?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-dynamic-tags': OasBase & {
        name?: string
        value?: string
        placeholder?: string
        onOasChange?: (e: Event) => void
      }
      'oas-pin-input': OasBase & {
        name?: string
        length?: string | number
        value?: string
        onOasChange?: (e: Event) => void
      }
      'oas-rate': OasBase & {
        name?: string
        value?: string | number
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-watermark': OasBase & {
        text?: string
        image?: string
        opacity?: string | number
        repeat?: boolean
      }
      'oas-statistic': OasBase & {
        value?: string | number
        precision?: string | number
        prefix?: string
        suffix?: string
        'group-separator'?: string
        loading?: boolean
      }
      'oas-number-animation': OasBase & {
        value?: string | number
        duration?: string | number
        'to-fixed'?: string | number
      }
      'oas-descriptions': OasBase & {
        column?: string | number
        title?: string
      }
      'oas-descriptions-item': OasBase & {
        label?: string
      }
      'oas-divider': OasBase
      'oas-virtual-list': OasBase & {
        /** 行数据（LogEntry[] 等对象数组；组件 setter 走 property 通道） */
        items?: unknown
        height?: string | number
        'item-height'?: string | number
        buffer?: string | number
        onOasItem?: (e: Event) => void
        onOasScroll?: (e: Event) => void
      }
      'oas-anchor': OasBase & {
        items?: string
        active?: string
        direction?: string
        hash?: string | boolean
        onOasClick?: (e: Event) => void
      }
      'oas-steps': OasBase & {
        /** 步骤定义（JSON 字符串，如 [{ title: '待支付' }, …]） */
        steps?: string
        current?: string | number
        /** 允许点击步骤跳转（form 向导页在用） */
        clickable?: boolean
        onOasChange?: (e: Event) => void
      }
      'oas-timeline': OasBase
      'oas-timeline-item': OasBase & {
        time?: string
        color?: string
      }
      'oas-result': OasBase & {
        status?: string
        title?: string
        description?: string
      }
      'oas-tree': OasBase & {
        /** 节点数据（JSON 字符串；组件亦定义 data property，两通道均收） */
        data?: string
        /** 默认展开 key，逗号分隔 */
        expanded?: string
        /** 选中 key（单选；undefined 移除属性回退无选中态） */
        selected?: string
        checked?: string
        checkable?: boolean
        height?: string | number
        onOasSelect?: (e: Event) => void
        onOasNodeRender?: (e: Event) => void
      }
      'oas-splitter': OasBase & {
        percent?: string | number
        min?: string | number
        max?: string | number
      }
      'oas-textarea': OasBase & {
        name?: string
        value?: string
        rows?: string | number
        placeholder?: string
        resize?: string
        /** vanilla basic-form 页原样写入的属性（组件当前不渲染 label，仅为 DOM 对齐） */
        label?: string
        disabled?: boolean
        readonly?: boolean
        onOasInput?: (e: Event) => void
      }
      'oas-checkbox-group': OasBase & {
        name?: string
        /** 选中值（JSON 字符串数组） */
        value?: string
        disabled?: boolean
        onOasChange?: (e: Event) => void
      }
    }
  }
}
