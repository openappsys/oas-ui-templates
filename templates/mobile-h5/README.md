# OAS Mobile（mobile-h5）

oas-ui 移动端 H5 **最小骨架试水**：零框架（vanilla TS）直接消费 web components，
演示组件库移动端专项能力（v2.5.1 移动专项 + v2.5.4 app-bar/float-button）的最小闭环。

> 试水定位：页面集与功能刻意保持最小（首页卡片流 / 我的 / 发布 bottom-sheet）。
> 方向验证后再按完整页面集扩展；i18n / 单测 / 门户入口暂未接入。

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:5175
pnpm build      # tsc --noEmit && vite build
pnpm test:e2e   # playwright（390×844 移动视口）
```

## 骨架能力对照

| 骨架件 | 组件 | 演示点 |
|---|---|---|
| 顶栏 | `oas-app-bar` | hide-on-scroll + elevated + leading/actions 槽 |
| 底部导航 | `oas-bottom-navigation` | pill 胶囊形态 + safe-area-inset-bottom |
| 发布弹层 | `oas-bottom-sheet` | open 受控 + 拖拽把手 + max-height |
| 主操作 | `oas-float-button` | 悬浮按钮触发发布 |
| 表单移动形态 | oas-input / oas-textarea | form-associated（label for / FormData）|

## 按需注册

组件注册集中在 `src/main.ts`（子路径 import 白名单，对齐 admin-pro/vanilla 的
registry 模式）。接入新组件时需在此补行，否则元素不升级且无报错。
