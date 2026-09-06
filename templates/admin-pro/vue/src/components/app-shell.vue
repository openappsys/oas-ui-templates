<script setup lang="ts">
// src/components/app-shell.vue —— 布局壳：oas-layout + 头部 + 三形态导航 + 页签栏 + 面包屑 + footer
// NavMenu key 重挂载；no-chrome（未登录无壳）由路由守卫重定向 /login 天然接管
import { computed, onMounted, onUnmounted, ref, watch, onWatcherCleanup } from 'vue'
import { useRoute } from 'vue-router'
import { useT } from '../composables/use-t'
import { useNotifications } from '../composables/use-notifications'
import { navConfig, type NavConfig } from '../layout-config'
import { appRoutes, matchRoute } from '../router/routes'
import CommandPalette from './command-palette.vue'
import HeaderBar from './header-bar.vue'
import NavMenu from './nav-menu.vue'
import { routeHref } from './nav-items'
import NotificationsDrawer from './notifications-drawer.vue'
import TabsBar from './tabs-bar.vue'

/** oas-sidebar 的抽屉方法（☰ 在 sidebar 形态下开关联抽屉） */
interface SidebarElement extends HTMLElement {
  openDrawer(): void
  closeDrawer(): void
}

interface CrumbItem {
  label: string
  href?: string
}

/** 面包屑 items：对齐 vanilla syncNav——根 + （父级） + 当前页，首页/未知路由两级无 href */
function buildCrumbs(activePath: string, t: (key: string) => string): CrumbItem[] {
  const route = matchRoute(activePath)
  const home = appRoutes[0]
  const rootLabel = t('nav.root')
  if (route === undefined || route.path === home.path) {
    return [{ label: rootLabel }, { label: t(home.meta.titleKey) }]
  }
  const items: CrumbItem[] = [{ label: rootLabel, href: routeHref(home.path) }]
  const parentPath = route.meta.parent
  const parent = parentPath ? matchRoute(parentPath) : undefined
  if (parent && parentPath) {
    items.push({ label: t(parent.meta.titleKey), href: routeHref(parentPath) })
  }
  items.push({ label: t(route.meta.titleKey) })
  return items
}

const { t: tt, locale } = useT()
const route = useRoute()
const activePath = computed(() => route.path)

/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const nav = ref<NavConfig>(navConfig())
const popoverOpen = ref(false)
const commandOpen = ref(false)
// 通知数据：badge（header-bar）与抽屉共享一份（解构出顶层 ref，模板自动解包）
const { items: notifItems, unread: notifUnread, readOne, readAll } = useNotifications()
const notifOpen = ref(false)

function onNavConfigChange(): void {
  nav.value = navConfig()
  popoverOpen.value = false
}
onMounted(() => window.addEventListener('oas:navconfig-change', onNavConfigChange))
onUnmounted(() => window.removeEventListener('oas:navconfig-change', onNavConfigChange))

watch(
  [activePath, locale],
  () => {
    const r = matchRoute(activePath.value)
    document.title = r ? `${tt(r.meta.titleKey)} · ${tt('app.fullname')}` : tt('app.fullname')
  },
  { immediate: true },
)

// ☰ 单击分派：sidebar 走自身抽屉；menubar/navigation 走悬浮菜单
function onNavToggle(): void {
  const el = document.getElementById('nav')
  if (el?.tagName === 'OAS-SIDEBAR') {
    const sidebar = el as SidebarElement
    if (sidebar.hasAttribute('drawer-open')) sidebar.closeDrawer()
    else sidebar.openDrawer()
  } else {
    popoverOpen.value = !popoverOpen.value
  }
}

watch(popoverOpen, (open) => {
  if (!open) return
  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('#menu-popover') || target.closest('#nav-toggle')) return
    popoverOpen.value = false
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') popoverOpen.value = false
  }
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  onWatcherCleanup(() => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
  })
})

const crumbs = computed(() => {
  void locale.value
  return JSON.stringify(buildCrumbs(activePath.value, tt))
})

// 页面入场动画：首次渲染不加 page-enter，路由切换后 key 重挂载 <main> 自然重放动画
const prevPath = ref<string | null>(null)
const pageEnter = ref(false)
watch(
  activePath,
  (p) => {
    pageEnter.value = prevPath.value !== null && prevPath.value !== p
    prevPath.value = p
  },
  { immediate: true },
)
</script>

<template>
  <oas-layout
    class="app"
    viewport
    :side="nav.position === 'top-head' ? 'top' : nav.position"
    :data-menu-style="nav.style"
  >
    <HeaderBar
      :notif-count="notifUnread"
      @nav-toggle="onNavToggle"
      @open-command="commandOpen = true"
      @toggle-notif="notifOpen = !notifOpen"
    >
      <template v-if="nav.position === 'top-head'" #header-menu>
        <div class="header-nav-menubar">
          <NavMenu
            :key="`${nav.style}:${nav.position}:h`"
            :menu-style="nav.style"
            :vertical="false"
            :active-path="activePath"
          />
        </div>
      </template>
    </HeaderBar>
    <div v-if="nav.position === 'top'" slot="sider" class="top-nav-bar">
      <NavMenu
        :key="`${nav.style}:${nav.position}:h`"
        :menu-style="nav.style"
        :vertical="false"
        :active-path="activePath"
      />
    </div>
    <div v-if="nav.position !== 'top' && nav.position !== 'top-head'" slot="sider" class="nav-sider">
      <NavMenu
        :key="`${nav.style}:${nav.position}:v`"
        :menu-style="nav.style"
        vertical
        :active-path="activePath"
      />
    </div>
    <div slot="content" class="content-col">
      <TabsBar />
      <div class="crumbs-bar">
        <oas-breadcrumb id="crumbs" :items="crumbs" />
      </div>
      <main id="view" :key="activePath" :class="pageEnter ? 'page-enter' : undefined">
        <router-view />
      </main>
      <footer class="app-foot">{{ t('app.footer') }}</footer>
    </div>
  </oas-layout>
  <CommandPalette :open="commandOpen" @open-change="commandOpen = $event" />
  <NotificationsDrawer
    :open="notifOpen"
    :items="notifItems"
    @close="notifOpen = false"
    @read-one="readOne"
    @read-all="readAll"
  />
  <div v-if="popoverOpen" id="menu-popover" class="menu-popover">
    <NavMenu
      :menu-style="nav.style"
      vertical
      :active-path="activePath"
      popover
      @navigate="popoverOpen = false"
    />
  </div>
</template>

<style scoped>
/* 布局壳样式（自 app.css 迁入）：scoped 仅追加 data-v 属性、不改类名，e2e 依赖的原始类名不受影响。
   指向子组件根元素的选择器（oas-menubar/oas-sider/.app-header/.tabs-bar 等）依赖
   「子组件根节点继承父组件 scope id」的特性，行为与迁移前一致 */
.app {
  height: 100%;
  overflow: hidden;
}

/* 顶部 menubar（top+menubar）：塞进 header 的 logo 与搜索之间。
   解决之前 .in-header-nav 被 flex 挤压崩坏的坑——菜单区 flex-shrink:0 + max-width 上限，
   不参与 header 的 flex 收缩（搜索框 spacer 会先被压缩而不是把菜单压扁/换行），
   下拉可溢出（overflow:visible）且浮于内容上。 */
.header-nav-menubar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  overflow: visible;
  position: relative;
  z-index: 30;
}
.header-nav-menubar > oas-menubar {
  display: block;
  width: auto;
  overflow: visible;
}

/* 顶部导航条（top 模式）：占 sider 槽全宽一行，菜单项按内容宽横排，下拉可溢出且浮于内容上 */
.top-nav-bar {
  width: 100%;
  min-height: 0;
  overflow: visible;
  padding: var(--oas-space-1) var(--oas-space-3);
  border-bottom: 1px solid var(--oas-color-border);
  position: relative;
  z-index: 30;
}
/* 顶部菜单条撑满导航条：barRight 以视口右缘为准，避免子菜单被误判溢出而错翻（图标被推出屏外）。
   此前 width:100% 坍塌是 .in-header-nav 的 flex 挤压所致；独立 .top-nav-bar 下可安全满宽 */
.top-nav-bar > oas-menubar,
.top-nav-bar > oas-navigation-menu {
  width: 100%;
}
/* sider 槽菜单容器（left/right 模式）：填满轨道高度。宽度不由容器定——三形态共用一个 .nav-sider 容器，
   若在此定宽会破坏 sidebar 折叠（oas-sider 折叠收窄到 64px 时容器仍 200px，内容区不扩）→ 宽度下放到 nav-menu.vue */
.nav-sider {
  height: 100%;
  min-height: 0;
}
/* menubar/navigation 竖排：补整列面板背景 + 右缘分隔线，与 sidebar（内嵌 oas-sider 自带 --oas-color-bg-hover
   背景 + 200px 轨、右缘即面板缘）外观统一——否则它们只是左上角小卡片、下方大片空白、无与正文的分隔感。
   用 :has() 限定仅 menubar/navigation 生效，避免污染 sidebar（其面板由内嵌 oas-sider 提供，会双重背景/边框） */
.nav-sider:has(> oas-menubar),
.nav-sider:has(> oas-navigation-menu) {
  background: var(--oas-color-bg-hover);
  border-right: 1px solid var(--oas-color-border);
}
/* menubar/navigation 竖排：宽度自适应贴合菜单内容（总览/业务/系统/示例 等短项，贴合后侧栏紧凑、
   无大片空白——固定 200px 时面板撑满但菜单项只占顶部，显得空荡）。面板背景/分隔线仍随 sider 槽保留。
   host 是 inline-block 不撑满，display:block 让 .bar.vertical align-items:stretch 生效填满面板高 */
.nav-sider > oas-menubar,
.nav-sider > oas-navigation-menu {
  display: block;
  min-width: 0;
}
/* 菜单条/多级导航顶部下拉需溢出 sider 区（不被 viewport 的 overflow-y:auto 裁剪）。
   data-side 设在内部 .struct 而非宿主，须用宿主反射的 side 属性匹配 */
oas-layout[side="top"]::part(sider) {
  overflow: visible;
}
/* menubar/navigation 左/右竖排：下拉往右浮出，sider 需 visible（否则 62px 窄区 auto 裁剪子菜单、出滚动条）。
   仅对菜单条/多级导航生效；sidebar 树形仍需 sider 内部滚动，故用 data-menu-style 区分（非 sidebar 才 visible） */
oas-layout[data-menu-style="menubar"]::part(sider),
oas-layout[data-menu-style="navigation"]::part(sider) {
  overflow: visible;
}

.content-col {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.crumbs-bar {
  flex-shrink: 0;
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 var(--oas-space-4);
  border-bottom: 1px solid var(--oas-color-border);
  background: var(--oas-color-bg);
}
#view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
/* 向导页步骤条需吸底操作区，viewport 不能裁剪（.form-wizard 在子页面组件内，:has() 内部不做 scope 改写） */
#view:has(.form-wizard) {
  overflow: visible;
}
#view.page-enter {
  animation: viewEnter 180ms ease-out;
}
@keyframes viewEnter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  #view.page-enter {
    animation: none;
  }
}
.app-foot {
  flex-shrink: 0;
  padding: var(--oas-table-cell-padding-block, var(--oas-space-3)) var(--oas-space-4);
  color: var(--oas-color-text-secondary);
  font-size: 12px;
  text-align: center;
}

/* 无壳模式：隐藏全部壳层 chrome。#app 在 index.html（不参与 scope），
   目标元素均在本组件模板或子组件根节点上（继承本组件 data-v），scoped 生效 */
#app.no-chrome .app-header,
#app.no-chrome oas-sider,
#app.no-chrome .crumbs-bar,
#app.no-chrome .tabs-bar,
#app.no-chrome .app-foot {
  display: none;
}
#app.no-chrome #view {
  min-height: 100vh;
}

/* ☰ 悬浮菜单面板（menubar/navigation）：点 ☰ 弹出，内嵌垂直 menubar——顶级=总览/业务/系统/示例，
   点击顶级项展开其子路由（还原 menubar 交互，而非 sidebar 式平铺列表）。
   宽度自适应：菜单贴顶级项内容宽（不强制 min-width 200px——竖排子菜单/巨型面板宽度由各自组件
   的 vp 变量/min-width 决定，与顶级项宽无关；强制 200px 会让短词顶级项（总览/业务等）占很宽） */
.menu-popover {
  position: fixed;
  top: calc(var(--app-header-height, 56px) + var(--oas-space-1));
  left: var(--oas-space-2);
  z-index: var(--oas-z-dropdown, 1000);
  background: var(--oas-color-bg);
  border: 1px solid var(--oas-color-border);
  border-radius: var(--oas-radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: var(--oas-space-1);
  width: fit-content;
}
.menu-popover[hidden] {
  display: none;
}
.menu-popover > oas-menubar,
.menu-popover > oas-navigation-menu {
  /* 不覆盖 display：组件 host 默认 inline-block（贴内容宽），fit-content 才能收缩到顶级项内容宽 */
  width: auto;
  max-width: 100%;
}

@media (max-width: 768px) {
  /* 移动端：menubar/navigation 的侧栏/顶部菜单收起，统一由 ☰ 弹出抽屉导航（避免菜单仍显示 + ☰ 并存）。
     仅限菜单条/多级导航（:has() 判定），sidebar 的 .nav-sider 内嵌 oas-sider，移动端走自身 drawer（oas-sider 收窄为 0 由 nav-menu.vue 处理），不可整容器隐藏。
     .header-nav-menubar（top-head 塞 header 的菜单）同样收起，只留 ☰ */
  .nav-sider:has(> oas-menubar),
  .nav-sider:has(> oas-navigation-menu),
  .top-nav-bar:has(> oas-menubar),
  .top-nav-bar:has(> oas-navigation-menu),
  .header-nav-menubar {
    display: none;
  }
}
</style>
