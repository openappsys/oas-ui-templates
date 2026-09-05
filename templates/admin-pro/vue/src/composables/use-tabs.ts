// src/composables/use-tabs.ts —— tabs 纯函数状态机的 Vue binding
// reactive 持有 TabsView；currentPath 变化时 visit；
// 关闭操作产生的 navigateTo 暴露给调用方执行 router.push()，下一次 visit 时自动清除
import { reactive, watch, type Ref } from 'vue'
import {
  closeAll as closeAllTabs,
  closeKeys as closeTabsByKeys,
  closeTab as closeOneTab,
  visit,
  type TabsView,
} from '../router/tabs'

interface TabsState {
  view: TabsView
  navigateTo: string | null
}

export function useTabs(currentPath: Ref<string>) {
  const state = reactive<TabsState>({ view: { keys: [], active: null }, navigateTo: null })

  watch(
    currentPath,
    (path) => {
      state.view = visit(state.view, path)
      state.navigateTo = null
    },
    { immediate: true },
  )

  function closeTab(key: string) {
    const result = closeOneTab(state.view, key)
    state.view = result.view
    state.navigateTo = result.navigateTo
  }

  function closeKeys(keys: string[]) {
    const result = closeTabsByKeys(state.view, keys)
    state.view = result.view
    state.navigateTo = result.navigateTo
  }

  function closeAll() {
    const result = closeAllTabs(state.view)
    state.view = result.view
    state.navigateTo = result.navigateTo
  }

  return { state, closeTab, closeKeys, closeAll }
}
