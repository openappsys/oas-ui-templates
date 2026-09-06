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
