// 应用层 i18n：saved > navigator.language 嗅探 > zh-CN 默认
// 注意：组件内置文案（popconfirm 确定/取消等）由 cdn.js 内联 registry 控制，恒为 zh-CN（已知边界）
// 同步锚定：index.html <head> 内有同逻辑的 FOUC 内联脚本，改 KEY / matchBrowser 须两处同步
const KEY = 'oas-admin-cdn.locale'
const listeners = new Set()

const dict = {
  'zh-CN': {
    'app.title': 'OAS Admin CDN',
    'nav.group': '菜单',
    'nav.dashboard': '仪表盘',
    'nav.users': '用户管理',
    'nav.form': '基础表单',
    'header.lang': 'English',
    'header.logout': '退出',
    'login.title': '欢迎回来',
    'login.subtitle': '零构建 · CDN 引入 oas-ui 的轻量后台',
    'login.namePh': '输入任意用户名',
    'login.submit': '登 录',
    'login.tip': '演示环境：任意非空用户名即可登录',
    'dash.welcome': '欢迎回来',
    'dash.statVisits': '今日访问',
    'dash.statUsers': '新增用户',
    'dash.statOrders': '订单量',
    'dash.statRate': '转化率',
    'dash.vsYesterday': '较昨日',
    'dash.trendTitle': '访问趋势',
    'users.title': '用户管理',
    'users.searchPh': '搜索姓名 / 邮箱',
    'users.new': '新建用户',
    'users.th.name': '姓名',
    'users.th.email': '邮箱',
    'users.th.role': '角色',
    'users.th.created': '创建时间',
    'users.th.action': '操作',
    'users.role.admin': '管理员',
    'users.role.viewer': '只读',
    'users.edit': '编辑',
    'users.delete': '删除',
    'users.confirmDelete': '删除该用户？',
    'users.empty': '暂无用户',
    'users.formNew': '新建用户',
    'users.formEdit': '编辑用户',
    'users.save': '保存',
    'users.cancel': '取消',
    'users.ruleName': '请输入姓名',
    'form.title': '基础表单',
    'form.subtitle': 'oas-form 校验 / 提交 / 重置',
    'form.name': '项目名称',
    'form.category': '项目分类',
    'form.status': '状态',
    'form.desc': '项目描述',
    'form.submit': '提交',
    'form.reset': '重置',
    'form.ruleName': '请输入项目名称',
    'form.submitted': '已提交',
    'form.resetDone': '已重置',
  },
  en: {
    'app.title': 'OAS Admin CDN',
    'nav.group': 'Menu',
    'nav.dashboard': 'Dashboard',
    'nav.users': 'Users',
    'nav.form': 'Basic Form',
    'header.lang': '中文',
    'header.logout': 'Logout',
    'login.title': 'Welcome back',
    'login.subtitle': 'Zero-build admin powered by oas-ui via CDN',
    'login.namePh': 'Enter any username',
    'login.submit': 'Sign In',
    'login.tip': 'Demo: any non-empty username signs you in',
    'dash.welcome': 'Welcome back',
    'dash.statVisits': 'Visits Today',
    'dash.statUsers': 'New Users',
    'dash.statOrders': 'Orders',
    'dash.statRate': 'Conversion',
    'dash.vsYesterday': 'vs yesterday',
    'dash.trendTitle': 'Traffic Trend',
    'users.title': 'Users',
    'users.searchPh': 'Search name / email',
    'users.new': 'New User',
    'users.th.name': 'Name',
    'users.th.email': 'Email',
    'users.th.role': 'Role',
    'users.th.created': 'Created',
    'users.th.action': 'Action',
    'users.role.admin': 'Admin',
    'users.role.viewer': 'Viewer',
    'users.edit': 'Edit',
    'users.delete': 'Delete',
    'users.confirmDelete': 'Delete this user?',
    'users.empty': 'No users',
    'users.formNew': 'New User',
    'users.formEdit': 'Edit User',
    'users.save': 'Save',
    'users.cancel': 'Cancel',
    'users.ruleName': 'Name is required',
    'form.title': 'Basic Form',
    'form.subtitle': 'oas-form validate / submit / reset',
    'form.name': 'Project Name',
    'form.category': 'Category',
    'form.status': 'Status',
    'form.desc': 'Description',
    'form.submit': 'Submit',
    'form.reset': 'Reset',
    'form.ruleName': 'Please enter project name',
    'form.submitted': 'Submitted',
    'form.resetDone': 'Reset',
  },
}

function matchBrowser(lang) {
  const n = (lang || '').toLowerCase()
  if (n === 'zh' || n.startsWith('zh-')) return 'zh-CN'
  if (n.startsWith('en')) return 'en'
  return 'zh-CN'
}

export function detectLocale() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* 隐私模式 */
  }
  return matchBrowser(navigator.language)
}

let locale = detectLocale()

export function currentLocale() {
  return locale
}

export function setLocale(next) {
  if (next !== 'zh-CN' && next !== 'en') return
  locale = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next
  for (const fn of listeners) fn(next)
}

export function t(key) {
  return dict[locale][key] ?? key
}

export function onLocaleChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
