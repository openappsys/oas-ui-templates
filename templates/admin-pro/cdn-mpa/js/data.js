const USERS_KEY = 'oas-admin-cdn-mpa.users'
const NAMES = [
  '张伟',
  '李娜',
  '王强',
  '刘洋',
  '陈静',
  '杨帆',
  '赵敏',
  '周杰',
  '吴倩',
  '郑浩',
  '孙丽',
  '朱军',
  '林霞',
  '何斌',
  '郭蕾',
  '马超',
  '罗丹',
  '高翔',
  '董洁',
  '萧然',
]

export function seedUsers() {
  return NAMES.map((name, i) => ({
    id: i + 1,
    name,
    email: `user${i + 1}@example.com`,
    role: i % 5 === 0 ? 'admin' : 'viewer',
    created: `2026-0${(i % 8) + 1}-1${i % 9}`,
  }))
}

export function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) {
      const v = JSON.parse(raw)
      if (Array.isArray(v)) return v
    }
  } catch {
    /* 坏数据回退种子 */
  }
  return seedUsers()
}

export function saveUsers(rows) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}
