export type DataSource = 'dexie' | 'api'

export const DATA_SOURCE_KEY = 'oas-pm-data'

/** 数据源必须在播种前决断：API 模式不碰 IndexedDB（不播 10W seed、不走启动兜底页） */
export function loadDataSource(): DataSource {
  try {
    return localStorage.getItem(DATA_SOURCE_KEY) === 'api' ? 'api' : 'dexie'
  } catch {
    return 'dexie'
  }
}

export function storeDataSource(source: DataSource): void {
  try {
    if (source === 'api') localStorage.setItem(DATA_SOURCE_KEY, 'api')
    else localStorage.removeItem(DATA_SOURCE_KEY)
  } catch {
    // 隐私模式下写不进去：只影响下次启动的选择，不阻断当前会话
  }
}
