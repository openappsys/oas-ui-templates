// oas-* web components TS 声明（按需补充）
import type { HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'oas-icon': HTMLAttributes<HTMLElement> & { name: string; size?: number | string }
      'oas-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: 'small' | 'medium' | 'large'
        type?: string
        closable?: boolean | string
      }
      'oas-button': HTMLAttributes<HTMLElement> & {
        type?: string
        size?: string
        disabled?: boolean | string
      }
      'oas-card': HTMLAttributes<HTMLElement> & { title?: string }
      'oas-switch': HTMLAttributes<HTMLElement> & { checked?: boolean | string }
      'oas-slider': HTMLAttributes<HTMLElement> & {
        value?: number | string
        min?: number | string
        max?: number | string
      }
      'oas-empty': HTMLAttributes<HTMLElement> & { description?: string }
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
    }
  }
}
