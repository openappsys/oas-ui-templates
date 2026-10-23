// oas-* web components TS 声明（按需补充）
import type { HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'oas-icon': HTMLAttributes<HTMLElement> & { name: string; size?: number | string }
      'oas-app-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        heading?: string
        position?: string
        elevated?: boolean | string
        'menu-button'?: boolean | string
      }
      'oas-dropdown': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        open?: boolean | string
        value?: string
        placement?: string
        trigger?: string
        arrow?: boolean | string
        split?: boolean | string
        disabled?: boolean | string
        /** 选中后是否关闭：false 用于「连点多项」的设置菜单 */
        'hide-on-click'?: string
        size?: string
      }
      'oas-dropdown-item': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        value?: string
        icon?: string
        kind?: string
        disabled?: boolean | string
        danger?: boolean | string
      }
      'oas-dropdown-group': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label?: string
        value?: string
      }
      'oas-dropdown-divider': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
      'oas-popover': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        open?: boolean | string
        /** 触发方式（空格分隔多选）：click / hover / focus / contextmenu / manual */
        trigger?: string
        placement?: string
        /** 面板宽度：数字(px) / "trigger" / 任意 CSS 值 */
        width?: string | number
        arrow?: boolean | string
        closable?: boolean | string
        'focus-on-open'?: boolean | string
        'hide-when-detached'?: boolean | string
        'auto-adjust-overflow'?: boolean | string
        'append-to'?: string
      }
      'oas-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: 'small' | 'medium' | 'large'
        type?: string
        closable?: boolean | string
      }
      'oas-button': HTMLAttributes<HTMLElement> & {
        type?: string
        size?: string
        disabled?: boolean | string
        /** 撑满父容器宽度（dist 契约的 block 属性） */
        block?: boolean | string
        /** 列表内渲染时 React 需要 key；WC 声明缺 Attributes 交集，这里补上 */
        key?: string | number
      }
      'oas-card': HTMLAttributes<HTMLElement> & { title?: string }
      'oas-switch': HTMLAttributes<HTMLElement> & { checked?: boolean | string }
      'oas-slider': HTMLAttributes<HTMLElement> & {
        value?: number | string
        min?: number | string
        max?: number | string
      }
      'oas-empty': HTMLAttributes<HTMLElement> & {
        description?: string
        size?: string
        'hide-image'?: boolean | string
      }
      'oas-list-item': HTMLAttributes<HTMLElement> & { title?: string }
      'oas-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string
        'max-height'?: string
        bordered?: boolean | string
        split?: boolean | string
        hoverable?: boolean | string
      }
      'oas-progress': HTMLAttributes<HTMLElement> & {
        percent?: number | string
        'show-text'?: boolean | string
      }
      'oas-gantt': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'row-height'?: number | string
        stripe?: boolean | string
      }
      'oas-modal': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        title?: string
        'no-footer'?: boolean | string
        visible?: boolean | string
      }
      'oas-input': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string
        placeholder?: string
        disabled?: boolean | string
        /** 表单字段名（oas-form 按 name 收集取值） */
        name?: string
        type?: string
        'show-password'?: boolean | string
      }
      'oas-form': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        /** 校验规则（property 通道，支持 validator 函数，故不落 attribute） */
        rules?: unknown
        layout?: string
      }
      'oas-form-item': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string
        required?: boolean | string
      }
      'oas-chart': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string
      }
      'oas-kanban': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
      'oas-virtual-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        'item-height'?: number | string
      }
      'oas-comment': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        author?: string
        datetime?: string
      }
      'oas-drawer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        visible?: boolean | string
        placement?: string
      }
      'oas-textarea': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string
        placeholder?: string
      }
      'oas-segmented': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        block?: boolean | string
        size?: string
      }
      'oas-tabs': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'tab-position'?: string
        size?: string
        type?: string
        'hide-content'?: boolean | string
        items?: string
        active?: string
      }
      'oas-resource': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        scale?: string
        height?: number | string
        'show-load-values'?: boolean | string
        'show-overload-badge'?: boolean | string
      }
      'oas-statistic': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        title?: string
      }
      'oas-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        columns?: unknown
        data?: unknown
        'row-key'?: string
      }
      'oas-popconfirm': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        title?: string
        trigger?: string
      }
      'oas-alert': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string
        variant?: string
        size?: string
      }
      'oas-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string
        size?: string
        offset?: string
      }
      'oas-dynamic-tags': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        placeholder?: string
      }
      'oas-select': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string
        placeholder?: string
        multiple?: boolean | string
        searchable?: boolean | string
        clearable?: boolean | string
        disabled?: boolean | string
        /** 已选项折叠上限（超出显示 +N 徽标） */
        'max-tag-count'?: number | string
      }
      'oas-checkbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        checked?: boolean | string
        disabled?: boolean | string
        size?: string
      }
      'oas-avatar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        color?: string
        size?: number | string
        text?: string
      }
      'oas-kbd': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        keys?: string
        variant?: string
        size?: string
        color?: string
      }
      'oas-skeleton': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        rows?: number | string
        count?: number | string
        widths?: string
        avatar?: boolean | string
        active?: boolean | string
        loading?: boolean | string
        effect?: string
        delay?: number | string
      }
      'oas-result': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        status?: string
        title?: string
        description?: string
        size?: string
      }
      'oas-command': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        open?: boolean | string
        'should-filter'?: boolean | string
        placeholder?: string
        hotkey?: string
      }
      'oas-sidebar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'hide-toggle'?: boolean | string
        'active-by-group'?: string
        shortcut?: boolean | string
        collapsed?: boolean | string
      }
      'oas-scheduler': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        view?: string
        locale?: string
        'start-hour'?: number | string
        'end-hour'?: number | string
        'first-day-of-week'?: number | string
      }
      'oas-date-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string
        clearable?: boolean | string
        placeholder?: string
      }
      'oas-time-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string
        placeholder?: string
        disabled?: boolean | string
        /** 24h token（缺省 HH:mm:ss），dist 契约支持 */
        format?: string
      }
    }
  }
}
