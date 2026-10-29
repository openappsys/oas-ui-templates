// oas-* Web Components 的 Vue 全局组件类型声明：让 <oas-*> 标签在模板中通过 tsc（content mapper）检查。
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
    'oas-form-list': OasComponent
    'oas-card': OasComponent
    'oas-tag': OasComponent
    'oas-space': OasComponent
    'oas-modal': OasComponent
    'oas-drawer': OasComponent
    'oas-switch': OasComponent
    'oas-checkbox': OasComponent
    'oas-radio': OasComponent
    'oas-color-picker': OasComponent
    'oas-swatch': OasComponent
    'oas-swatch-group': OasComponent
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
    'oas-highlight': OasComponent
    'oas-marquee': OasComponent
    'oas-textarea': OasComponent
  }
  // TS 7.1 content mapper（v4 alpha）对模板属性严格化：放行合法 HTML 全局属性——
  // slot（Web Components 插槽分配）与 data-*（vue-tsc 3 均放行，运行时本就透传）
  interface HTMLAttributes {
    slot?: string
    [key: `data-${string}`]: unknown
  }
  // 组件侧：mapper 对组件 props 做 camelCase 规范化（data-testid → dataTestid），
  // 故需 camelCase 形式的签名；kebab 形式一并保留（防御未规范化的路径）。
  // data-* 经 fallthrough 落到根元素（如 RouterLink→<a>），运行时本就透传。
  // 注意不能 augment 'vue-router' 的 RouterLinkProps——bundle d.ts 的 re-export
  // 符号在 TS 7.1 beta 下合并不生效（金丝雀实测）；ComponentCustomProps 是官方
  // 的「所有组件通用属性」扩展点，这里实测可合并。
  interface ComponentCustomProps {
    [key: `data-${string}`]: unknown
    [key: `data${Capitalize<string>}`]: unknown
  }
}
