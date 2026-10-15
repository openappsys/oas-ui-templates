// oas-* web components TS 声明（按需补充）
import type { HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'oas-icon': HTMLAttributes<HTMLElement> & { name: string; size?: number | string }
      'oas-tag': HTMLAttributes<HTMLElement> & {
        size?: 'small' | 'medium' | 'large'
        type?: string
      }
      'oas-button': HTMLAttributes<HTMLElement> & { type?: string; size?: string }
      'oas-card': HTMLAttributes<HTMLElement> & { title?: string }
      'oas-badge': HTMLAttributes<HTMLElement> & { value?: string; size?: string; offset?: string }
      'oas-switch': HTMLAttributes<HTMLElement> & { checked?: boolean | string }
      'oas-slider': HTMLAttributes<HTMLElement> & {
        value?: number | string
        min?: number | string
        max?: number | string
      }
      'oas-empty': HTMLAttributes<HTMLElement> & { description?: string }
      'oas-list-item': HTMLAttributes<HTMLElement> & { title?: string }
      'oas-progress': HTMLAttributes<HTMLElement> & {
        percent?: number | string
        'show-text'?: boolean | string
      }
    }
  }
}
