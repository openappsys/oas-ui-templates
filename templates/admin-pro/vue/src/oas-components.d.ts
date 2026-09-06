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
    'oas-radio': any
    'oas-color-picker': any
    'oas-slider': any
    'oas-segmented': any
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
    'oas-progress': any
    'oas-chart': any
  }
}
export {}
