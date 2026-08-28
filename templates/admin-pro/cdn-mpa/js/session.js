const SESSION_KEY = 'oas-admin-cdn-mpa.session'

export function readSession() {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return v && typeof v === 'object' && typeof v.name === 'string' ? v : null
  } catch {
    return null
  }
}

export function writeSession(name) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name }))
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
  location.href = './index.html'
  return false
}
