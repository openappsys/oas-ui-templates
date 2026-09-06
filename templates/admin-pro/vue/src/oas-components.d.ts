// oas-* Web Components 的 Vue 全局组件类型声明：让 <oas-*> 标签在模板中通过 vue-tsc 检查。
// 统一用 any 起步——vue-tsc 对 custom element props 类型化收益低、成本高；
// 标签清单与 react 版 src/elements.d.ts 同步维护。
declare module 'vue' {
  interface GlobalComponents {
    'oas-button': any
    'oas-icon': any
    'oas-input': any
    'oas-select': any
    'oas-form': any
    'oas-form-item': any
    'oas-card': any
    'oas-tag': any
    'oas-space': any
    'oas-modal': any
    'oas-drawer': any
    'oas-switch': any
    'oas-checkbox': any
    'oas-radio': any
    'oas-color-picker': any
    'oas-slider': any
    'oas-segmented': any
    'oas-input-number': any
    'oas-date-picker': any
    'oas-upload': any
    'oas-theme-editor': any
    'oas-layout': any
    'oas-sider': any
    'oas-sidebar': any
    'oas-menubar': any
    'oas-navigation-menu': any
    'oas-tabs': any
    'oas-tab-panel': any
    'oas-breadcrumb': any
    'oas-command': any
    'oas-badge': any
    'oas-dropdown': any
    'oas-avatar': any
    'oas-list': any
    'oas-list-item': any
    'oas-skeleton': any
    'oas-empty': any
    'oas-table': any
    'oas-masonry': any
    'oas-pagination': any
    'oas-popconfirm': any
    'oas-page-header': any
    'oas-progress': any
    'oas-chart': any
    'oas-auto-complete': any
    'oas-cascader': any
    'oas-combobox': any
    'oas-pin-input': any
    'oas-rate': any
    'oas-dynamic-tags': any
    'oas-tree-select': any
    'oas-transfer': any
    'oas-watermark': any
    'oas-number-animation': any
    'oas-statistic': any
    'oas-descriptions': any
    'oas-descriptions-item': any
    'oas-divider': any
    // Task 2（orders/order-detail/result/category/logs 页）新增：react 版 elements.d.ts
    // 尚无对应页面，按 vanilla-html 用到的标签补入，react 版落地时同步
    'oas-steps': any
    'oas-timeline': any
    'oas-timeline-item': any
    'oas-result': any
    'oas-virtual-list': any
    'oas-anchor': any
    // Task 4（dept/dict/menus/roles/basic-form/form 页）新增：同上按 vanilla 用到的标签补入
    'oas-tree': any
    'oas-splitter': any
    'oas-checkbox-group': any
  }
}
export {}
