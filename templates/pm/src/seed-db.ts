import type { Cycle, Issue, Project, Member } from './types'
import { db } from './db/schema'
import { demoCycleIdFor } from './lib/cycles'
import { mulberry32 } from './lib/prng'

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

export async function seedDatabase(): Promise<void> {
  // seed 版本标记：调整 seed 逻辑后 bump。标记 + 数据双验证——
  // 单看标记会在「上次 seed 中断」时永久跳过，留下空库
  const SEED_VER = 'oas-pm-seed-v8'
  const marked = localStorage.getItem(SEED_VER)
  const issueCount = await db.issues.count()
  if (marked && issueCount > 0) return
  // 旧 seed 数据（v1 的 updatedAt 走了未来时间戳）/ 中断残留 清表重播；
  // 不用 db.delete()——会关闭模块级 Dexie 单例的连接
  await Promise.all(db.tables.map((t) => t.clear()))

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
      nextKeyNum: 100001,
    },
    {
      id: 'project-2',
      name: '移动端 App',
      key: 'APP',
      description: '移动端产品迭代',
      leadId: 'member-2',
      createdAt: now - 60 * day,
      nextKeyNum: 200001,
    },
  ]
  await db.projects.bulkPut(projects)

  // 迭代（Sprint）：project-1 两份已结束 + 一份进行中（now ∈ [start,end) 派生当前，无 status 字段）。
  // 区间按天对齐，与 API mock 的 buildSeed 同形；归属规则见 lib/cycles.demoCycleIdFor
  const cycles: Cycle[] = [
    {
      id: 'cycle-1',
      projectId: 'project-1',
      name: 'Sprint 1',
      startAt: now - 28 * day,
      endAt: now - 14 * day,
      goal: '平台基础能力',
      createdAt: now - 28 * day,
      updatedAt: now - 14 * day,
    },
    {
      id: 'cycle-2',
      projectId: 'project-1',
      name: 'Sprint 2',
      startAt: now - 14 * day,
      endAt: now,
      goal: '权限与导出',
      createdAt: now - 14 * day,
      updatedAt: now,
    },
    {
      id: 'cycle-3',
      projectId: 'project-1',
      name: 'Sprint 3',
      startAt: now,
      endAt: now + 14 * day,
      goal: '性能与体验',
      createdAt: now,
      updatedAt: now,
    },
  ]
  await db.cycles.bulkPut(cycles)

  const ISSUE_COUNT = 100_000
  const statuses = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'] as const
  const priorities = ['urgent', 'high', 'medium', 'low'] as const
  const CHUNK = 5000
  // 日程演示组（末 90 条）：未来两周三档铺满（j%3 → UTC 0/9/14 点桶）+ 逾期样本 + done 灰化样本；
  // updatedAt 取近 2 天 → 恒落默认 500 窗口，日程视图开箱即有内容且分布确定
  const SCHEDULE_DEMO = 90
  const schedFirst = ISSUE_COUNT - SCHEDULE_DEMO
  const nb = new Date(now)
  const dayAt = (addDays: number, hour: number) =>
    Date.UTC(nb.getUTCFullYear(), nb.getUTCMonth(), nb.getUTCDate() + addDays, hour)

  console.time('seed:100k')
  for (let chunk = 0; chunk < ISSUE_COUNT / CHUNK; chunk++) {
    const batch: Issue[] = []
    for (let i = 0; i < CHUNK; i++) {
      const idx = chunk * CHUNK + i
      const proj = rand() > 0.3 ? projects[0] : projects[1]
      const schedJ = idx - schedFirst
      const inSched = schedJ >= 0
      const status: Issue['status'] = inSched
        ? schedJ % 10 === 7
          ? 'done'
          : (['backlog', 'todo', 'in_progress'] as const)[schedJ % 3]
        : statuses[Math.floor(rand() * (idx < ISSUE_COUNT * 0.2 ? 3 : 5))]
      const priority = priorities[Math.floor(rand() * 4)]
      const assignee = rand() > 0.15 ? members[Math.floor(rand() * members.length)] : null
      const title = TITLES[Math.floor(rand() * TITLES.length)]
      const createdAt = now - Math.floor(rand() * 90) * day
      const labels: string[] = []
      const labelCount = Math.floor(rand() * 3)
      for (let j = 0; j < labelCount; j++) labels.push(LABELS[Math.floor(rand() * LABELS.length)])

      let dueAt: number | null
      let startAt: number | null = null
      let updatedAt: number
      if (inSched) {
        // j%5===4 → 逾期样本（未完成 + dueAt 已过 1–5 天，供逾期前缀验收）；
        // 其余铺未来 14 天，6 条一行 → 每天每桶约 2 条（week 同桶 +30min 偏移可验收）
        const overdueRow = schedJ % 5 === 4
        const dayOffset = overdueRow ? -(1 + (schedJ % 5)) : 1 + (Math.floor(schedJ / 6) % 14)
        // v7：非逾期行约 1/3 改精确非桶时刻（j%9 ∈ {1,5,6}——三个余数类分别覆盖 j%3 的
        // 0/1/2，上午/下午/全天各档仍留足桶时刻样本供前缀与平铺验收）；时刻按 j%3 轮换
        // [10:30/15:45/16:20]（全在 week/day 8–19 轴内），从 j 派生、不抽 rand——
        // 散耗 rand 会平移随机流，撞飞 e2e 锚定的 issue id（v6 教训）
        const preciseRow = !overdueRow && [1, 5, 6].includes(schedJ % 9)
        if (preciseRow) {
          const [h, m] = [
            [10, 30],
            [15, 45],
            [16, 20],
          ][schedJ % 3]
          dueAt = dayAt(dayOffset, h) + m * 60000
        } else {
          const hour = [0, 9, 14][schedJ % 3]
          dueAt = dayAt(dayOffset, hour)
        }
        // 1/4 带 startAt 紧凑区间（1–3 天，恒 ≤ dueAt）：pm 桶 k=1 样本供 e2e 倒挂钳制（回移一天触发收敛）
        startAt = schedJ % 4 === 1 ? dueAt - (1 + (schedJ % 3)) * day : null
        // 散量群体有 ~1800 行 updatedAt 被 clamp 到恰好 now（createdAt=今天 的行），
        // now-2d 内的 updatedAt 排不进默认 500 窗口——取 now+j 毫秒严格最新（真编辑发生在秒级之后，仍压头部）
        updatedAt = now + schedJ
      } else {
        dueAt = rand() > 0.6 ? createdAt + Math.floor(rand() * 14 + 3) * day : null
        // 1/4 带 startAt 紧凑区间（1–3 天，恒 ≤ dueAt）：从 dueAt 的日序号派生、不消耗 rand——
        // 多抽一次 rand 会平移整条随机流，既有 e2e 锚定的 issue id（如 issue-project-1-1001）会漂移消失
        const dayIdx = dueAt === null ? -1 : Math.floor(dueAt / day)
        startAt = dueAt !== null && dayIdx % 4 === 0 ? dueAt - (1 + (dayIdx % 3)) * day : null
        // 更新时间 clamp 到 now——seed 走未来时间戳会把真实新建/拖拽的数据压出窗口头部
        updatedAt = Math.min(createdAt + Math.floor(rand() * 3) * day, now)
      }
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
        startAt,
        dueAt,
        createdAt,
        updatedAt,
        completedAt:
          status === 'done' ? Math.min(createdAt + Math.floor(rand() * 5 + 1) * day, now) : null,
        order: idx,
        // 迭代归属只读 idx/dueAt（不抽 rand，否则随机流平移、e2e 锚定的 issue id 会漂移）；
        // 项目 2 没有周期 → 全部留在「未入迭代」
        cycleId: proj.id === 'project-1' ? demoCycleIdFor(idx, dueAt, cycles) : null,
      })
    }
    await db.issues.bulkPut(batch)
  }
  console.timeEnd('seed:100k')
  await db.settings.put({ key: 'labels', value: LABELS, updatedAt: Date.now() })
  localStorage.setItem(SEED_VER, '1')
}
