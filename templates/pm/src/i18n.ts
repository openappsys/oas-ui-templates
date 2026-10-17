/** PM 轻量 i18n：核心 UI 文案 zh/en，语言偏好 localStorage 持久化 */
export type Lang = 'zh' | 'en'

const dict = {
  zh: {
    newIssue: '＋ 新建 Issue',
    exportCsv: '导出 CSV（当前窗口）',
    search: '搜索 Key 或标题…（/）',
    about: '关于',
    notify: '动态',
    dashboard: '仪表盘',
    list: '列表',
    board: '看板',
    timeline: '时间线',
    projects: '项目',
    views: '视图',
    allIssues: '全部 Issues',
    myIssues: '我的',
    status: '状态',
    all: '全部',
    members: '成员',
    savedViews: '保存的视图',
    window: '窗口',
    sort: '排序',
    group: '分组',
    priority: '优先级',
    clearFilters: '清除筛选',
    saveView: '保存视图',
    key: 'Key',
    title: '标题',
    assignee: '负责人',
    none: '不分组',
    byPriority: '按优先级',
    byAssignee: '按负责人',
    recentUpdate: '最近更新',
    createdAt: '创建时间',
    subtasks: '子任务',
    relations: '关联',
    description: '描述',
    labels: '标签',
    comments: '评论',
    activities: '活动',
    addSub: '添加',
    descSave: '保存描述',
    delete: '删除',
    cancel: '取消',
    create: '创建',
    save: '保存',
    know: '知道了',
    send: '发送',
    commentPlaceholder: '写下评论…',
    ready: '就绪',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
  },
  en: {
    newIssue: '＋ New Issue',
    exportCsv: 'Export CSV (window)',
    search: 'Search key or title… (/)',
    about: 'About',
    notify: 'Activity',
    dashboard: 'Dashboard',
    list: 'List',
    board: 'Board',
    timeline: 'Timeline',
    projects: 'Projects',
    views: 'Views',
    allIssues: 'All Issues',
    myIssues: 'My Issues',
    status: 'Status',
    all: 'All',
    members: 'Members',
    savedViews: 'Saved Views',
    window: 'window',
    sort: 'Sort',
    group: 'Group',
    priority: 'Priority',
    clearFilters: 'Clear filters',
    saveView: 'Save view',
    key: 'Key',
    title: 'Title',
    assignee: 'Assignee',
    none: 'None',
    byPriority: 'By priority',
    byAssignee: 'By assignee',
    recentUpdate: 'Last updated',
    createdAt: 'Created',
    subtasks: 'Subtasks',
    relations: 'Relations',
    description: 'Description',
    labels: 'Labels',
    comments: 'Comments',
    activities: 'Activity',
    addSub: 'Add',
    descSave: 'Save description',
    delete: 'Delete',
    cancel: 'Cancel',
    create: 'Create',
    save: 'Save',
    know: 'Got it',
    send: 'Send',
    commentPlaceholder: 'Write a comment…',
    ready: 'Ready',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
  },
} as const

export type DictKey = keyof (typeof dict)['zh']

let currentLang: Lang = 'zh'

export function setLang(l: Lang): void {
  currentLang = l
  storeLang(l)
}

export function getLang(): Lang {
  return currentLang
}

export function t(key: DictKey): string {
  return dict[currentLang][key] ?? dict.zh[key] ?? key
}

export function loadLang(): Lang {
  return (localStorage.getItem('oas-pm-lang') as Lang) ?? 'zh'
}

export function storeLang(l: Lang): void {
  localStorage.setItem('oas-pm-lang', l)
}
