// src/router/use-tabs.ts —— tabs 纯函数状态机的 React binding
// useReducer 持有 TabsView；currentPath 变化时 dispatch visit；
// 关闭操作产生的 navigateTo 暴露给调用方执行 navigate()，下一次 visit 时自动清除
import { useCallback, useEffect, useReducer } from 'react'
import {
  closeAll as closeAllTabs,
  closeKeys as closeTabsByKeys,
  closeTab as closeOneTab,
  visit,
  type TabsView,
} from './tabs'

interface TabsState {
  view: TabsView
  navigateTo: string | null
}

type TabsAction =
  | { type: 'visit'; path: string }
  | { type: 'closeTab'; key: string }
  | { type: 'closeKeys'; keys: string[] }
  | { type: 'closeAll' }

function reduce(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'visit':
      return { view: visit(state.view, action.path), navigateTo: null }
    case 'closeTab': {
      const result = closeOneTab(state.view, action.key)
      return { view: result.view, navigateTo: result.navigateTo }
    }
    case 'closeKeys': {
      const result = closeTabsByKeys(state.view, action.keys)
      return { view: result.view, navigateTo: result.navigateTo }
    }
    case 'closeAll': {
      const result = closeAllTabs(state.view)
      return { view: result.view, navigateTo: result.navigateTo }
    }
  }
}

const initialState: TabsState = { view: { keys: [], active: null }, navigateTo: null }

export function useTabs(currentPath: string) {
  const [state, dispatch] = useReducer(reduce, initialState)

  useEffect(() => {
    dispatch({ type: 'visit', path: currentPath })
  }, [currentPath])

  const closeTab = useCallback((key: string) => dispatch({ type: 'closeTab', key }), [])
  const closeKeys = useCallback((keys: string[]) => dispatch({ type: 'closeKeys', keys }), [])
  const closeAll = useCallback(() => dispatch({ type: 'closeAll' }), [])

  return { view: state.view, closeTab, closeKeys, closeAll, navigateTo: state.navigateTo }
}
