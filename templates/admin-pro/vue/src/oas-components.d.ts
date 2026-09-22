// oas-* Web Components 的 Vue 全局组件类型声明：让 <oas-*> 标签在模板中通过 vue-tsc 检查。
// 策略：标准 HTML 属性强类型（HTMLAttributes）+ 组件任意属性经 unknown 放行——
//   any 会逃逸一切类型检查（且触发 lint/noExplicitAny），unknown 保留类型边界；
//   属性清单与 react 版 src/elements.d.ts 同步维护（react 版为逐组件 props 全量声明）。
import type { HTMLAttributes } from 'vue'

type OasComponent = HTMLAttributes & Record<string, unknown>

declare module 'vue' {
  interface GlobalComponents {
    'oas-button': OasComponent
    'oas-icon': OasComponent
    'oas-input': OasComponent
    'oas-select': OasComponent
    'oas-form': OasComponent
    'oas-form-item': OasComponent
    'oas-card': OasComponent
    'oas-tag': OasComponent
    'oas-space': OasComponent
    'oas-modal': OasComponent
    'oas-drawer': OasComponent
    'oas-switch': OasComponent
    'oas-checkbox': OasComponent
    'oas-radio': OasComponent
    'oas-color-picker': OasComponent
    'oas-slider': OasComponent
    'oas-segmented': OasComponent
    'oas-input-number': OasComponent
    'oas-date-picker': OasComponent
    'oas-upload': OasComponent
    'oas-theme-editor': OasComponent
    'oas-layout': OasComponent
    'oas-sider': OasComponent
    'oas-sidebar': OasComponent
    'oas-menubar': OasComponent
    'oas-navigation-menu': OasComponent
    'oas-tabs': OasComponent
    'oas-tab-panel': OasComponent
    'oas-breadcrumb': OasComponent
    'oas-command': OasComponent
    'oas-badge': OasComponent
    'oas-dropdown': OasComponent
    'oas-avatar': OasComponent
    'oas-list': OasComponent
    'oas-list-item': OasComponent
    'oas-skeleton': OasComponent
    'oas-empty': OasComponent
    'oas-table': OasComponent
    'oas-masonry': OasComponent
    'oas-pagination': OasComponent
    'oas-popconfirm': OasComponent
    'oas-page-header': OasComponent
    'oas-progress': OasComponent
    'oas-chart': OasComponent
    'oas-auto-complete': OasComponent
    'oas-cascader': OasComponent
    'oas-combobox': OasComponent
    'oas-pin-input': OasComponent
    'oas-rate': OasComponent
    'oas-dynamic-tags': OasComponent
    'oas-tree-select': OasComponent
    'oas-transfer': OasComponent
    'oas-watermark': OasComponent
    'oas-number-animation': OasComponent
    'oas-statistic': OasComponent
    'oas-descriptions': OasComponent
    'oas-descriptions-item': OasComponent
    'oas-divider': OasComponent
    // Task 2（orders/order-detail/result/category/logs 页）新增：react 版 elements.d.ts
    'oas-steps': OasComponent
    'oas-timeline': OasComponent
    'oas-timeline-item': OasComponent
    'oas-result': OasComponent
    'oas-virtual-list': OasComponent
    'oas-anchor': OasComponent
    'oas-tree': OasComponent
    'oas-splitter': OasComponent
    'oas-checkbox-group': OasComponent
  }
}
export {}
