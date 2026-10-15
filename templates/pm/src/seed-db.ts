import type { Issue, Project, Member } from './types'
import { db } from './db/schema'

const NAMES = ['张伟', '李娜', '王强', '赵敏', '刘洋', '陈静', '杨帆', '周琳']
const TITLES = [
  '修复登录页面白屏',
  '优化列表页加载速度',
  '实现数据导出功能',
  '重构用户权限模块',
  '设计新版仪表盘',
  '接入第三方支付',
  '修复移动端布局错位',
  '编写 API 接口文档',
  '数据库索引优化',
  '增加批量导入功能',
  '实现消息推送',
  '国际化支持（i18n）',
  '升级依赖版本',
  '代码审查反馈修复',
  '性能压力测试',
  '安全性漏洞扫描',
  '增加暗色主题',
  '优化表格排序算法',
  '实现实时协作编辑',
  '部署 CI/CD 流水线',
]
const LABELS = ['frontend', 'backend', 'design', 'bug', 'feature', 'tech-debt', 'docs', 'infra']

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function seedDatabase(): Promise<void> {
  if ((await db.projects.count()) > 0) return

  const rand = mulberry32(42)
  const now = Date.now()
  const day = 86400000

  const members: Member[] = NAMES.map((name, i) => ({
    id: `member-${i + 1}`,
    name,
    email: `user${i + 1}@oas.dev`,
    avatarColor: [
      '#0b6cff',
      '#7c3aed',
      '#059669',
      '#d97706',
      '#dc2626',
      '#0891b2',
      '#be185d',
      '#4f46e5',
    ][i % 8],
    role: (i === 0 ? 'admin' : i < 3 ? 'member' : 'viewer') as Member['role'],
  }))
  await db.members.bulkPut(members)

  const projects: Project[] = [
    {
      id: 'project-1',
      name: 'OAS 平台',
      key: 'OAS',
      description: '核心平台研发',
      leadId: 'member-1',
      createdAt: now - 90 * day,
    },
    {
      id: 'project-2',
      name: '移动端 App',
      key: 'APP',
      description: '移动端产品迭代',
      leadId: 'member-2',
      createdAt: now - 60 * day,
    },
  ]
  await db.projects.bulkPut(projects)

  const ISSUE_COUNT = 100_000
  const statuses = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as const
  const priorities = ['urgent', 'high', 'medium', 'low'] as const
  const CHUNK = 5000

  console.time('seed:100k')
  for (let chunk = 0; chunk < ISSUE_COUNT / CHUNK; chunk++) {
    const batch: Issue[] = []
    for (let i = 0; i < CHUNK; i++) {
      const idx = chunk * CHUNK + i
      const proj = rand() > 0.3 ? projects[0] : projects[1]
      const status = statuses[Math.floor(rand() * (idx < ISSUE_COUNT * 0.2 ? 3 : 5))]
      const priority = priorities[Math.floor(rand() * 4)]
      const assignee = rand() > 0.15 ? members[Math.floor(rand() * members.length)] : null
      const title = TITLES[Math.floor(rand() * TITLES.length)]
      const createdAt = now - Math.floor(rand() * 90) * day
      const labels: string[] = []
      const labelCount = Math.floor(rand() * 3)
      for (let j = 0; j < labelCount; j++) labels.push(LABELS[Math.floor(rand() * LABELS.length)])

      batch.push({
        id: `issue-${proj.id}-${idx + 1}`,
        projectId: proj.id,
        key: `${proj.key}-${idx + 1}`,
        title: `${title} #${idx + 1}`,
        description: '',
        status,
        priority,
        assigneeId: assignee?.id ?? null,
        reporterId: members[0].id,
        labels,
        startAt: null,
        dueAt: rand() > 0.6 ? createdAt + Math.floor(rand() * 14 + 3) * day : null,
        createdAt,
        updatedAt: createdAt + Math.floor(rand() * 3) * day,
        order: idx,
      })
    }
    await db.issues.bulkPut(batch)
  }
  console.timeEnd('seed:100k')
}
