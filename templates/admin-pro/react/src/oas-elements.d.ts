// oas-ui Web Components 的 JSX 类型声明：让 <oas-*> 标签在 React JSX 下通过 tsc 检查
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'oas-button': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string
      }
    }
  }
}
