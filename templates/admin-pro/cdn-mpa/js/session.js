const SESSION_KEY = 'oas-admin-cdn-mpa.session'

export function readSession() {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    // role 归一化：非 'viewer' 一律回落 admin（兼容修复前无 role 字段的旧会话）
    if (v && typeof v === 'object' && typeof v.name === 'string') {
      return { ...v, role: v.role === 'viewer' ? 'viewer' : 'admin' }
    }
    return null
  } catch {
    return null
  }
}

export function writeSession(name, role = 'admin') {
  try {
    // loginAt：个人中心「登录时间」展示用（毫秒时间戳）；role：viewer 只读演示路径开关
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ name, role: role === 'viewer' ? 'viewer' : 'admin', loginAt: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

// 受保护页入口第一行调用：未登录 → 跳登录页并返回 false（调用方应 early-return）
export function guard() {
  if (readSession()) return true
  location.replace('./index.html')
  return false
}
