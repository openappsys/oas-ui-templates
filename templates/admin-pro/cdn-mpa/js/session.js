const SESSION_KEY = 'oas-admin-cdn-mpa.session'

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
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

// 受保护页入口第一行调用：未登录 → 登录页
export function guard() {
  if (!readSession()) location.href = './index.html'
}
