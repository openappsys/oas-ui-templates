// src/pages/logs.tsx —— 日志中心（虚拟列表 + 日期锚点 + 统计卡 + 多条件过滤 + CSV 导出）
//    统计/锚点分组/空态全部由 state 派生
// 2. 事件绑定：level/keyword/date 的 oas-change/oas-input/oas-clear、虚拟列表 oas-item/oas-scroll、
//    锚点 oas-click、modal oas-cancel 走 useOasEvent（AGENTS.md 第 1 条）；导出按钮为 light DOM
//    原生 click 直绑 onClick；虚拟列表行 click 在 oas-item 回调里对 element 直绑（element 为
//    filtered/locale 变化时赋同一 property（setter 内部 slice + update，同引用也会重渲，
//    dangerouslySetInnerHTML 注入同款内容（见 ./logs-shared.ts）
//    锚点标题/表头/选项随 locale 重算，过滤条件与滚动位置不动
// 7. 子组件拆分（单文件 ≤400 行纪律）：纯函数助手与行模板 ./logs-shared.ts
// 8. oas-virtual-list 的 buffer 属性必须走 setAttribute：React 19 的 property 通道会覆写
//    组件原型方法 buffer()（字符串赋值），实测崩溃；详见挂载 effect 处注释
import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/pages/logs.css'
import { listLogs } from '../data/logs'
import type { LogEntry, LogLevel } from '../data/logs'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import {
  ITEM_HEIGHT,
  ITEM_TEMPLATE_HTML,
  LEVEL_TAG,
  buildDateGroups,
  dateKey,
  formatTime,
  levelLabel,
  levelOptions,
} from './logs-shared'

export default function LogsPage() {
  const { t, locale } = useT()
  const [rows, setRows] = useState<LogEntry[]>([])
  const [filtered, setFiltered] = useState<LogEntry[]>([])
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [selected, setSelected] = useState<LogEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 768px)').matches)

  const vlistRef = useRef<HTMLElement | null>(null)
  const levelRef = useRef<HTMLElement | null>(null)
  const keywordRef = useRef<HTMLElement | null>(null)
  const dateRef = useRef<HTMLElement | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)

  // vanilla init()：先拉全量（统计卡数据源），随后 applyFilter（过滤 effect 以 rows 为依赖）
  useEffect(() => {
    let cancelled = false
    void listLogs().then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // vanilla applyFilter：按 level/keyword/dateRange 异步过滤
  useEffect(() => {
    let cancelled = false
    void listLogs({ level, keyword, dateRange: dateRange ?? undefined }).then((list) => {
      if (!cancelled) setFiltered(list)
    })
    return () => {
      cancelled = true
    }
  }, [level, keyword, dateRange, rows])

  // vanilla renderVirtualList：items property 通道；locale 变化时重赋刷新行内标签（头注释 3）
  useEffect(() => {
    const vlist = vlistRef.current as (HTMLElement & { items?: LogEntry[] }) | null
    if (vlist) vlist.items = filtered
  }, [filtered, locale])

  // buffer 必须走 attribute 通道：React 19 对 custom element 上 `in` 命中的键一律 property
  // 赋值，而 oas-virtual-list 原型上的 buffer() 是方法（virtual-list.js 内 this.buffer()），
  // buffer="8" 字面量属性会把它覆写成字符串致页面崩溃（dev 走查实测踩中），故挂载时
  // setAttribute 补写（vanilla HTML 属性同通道；height/item-height 无同名键，可安全声明式）
  useEffect(() => {
    vlistRef.current?.setAttribute('buffer', '8')
  }, [])

  // vanilla scrollToIndex：经 shadowRoot .viewport 定位
  const scrollToIndex = (index: number) => {
    const viewport = (
      vlistRef.current as unknown as { shadowRoot: ShadowRoot } | null
    )?.shadowRoot.querySelector<HTMLElement>('.viewport')
    if (!viewport) return
    viewport.scrollTop = Math.max(0, index * ITEM_HEIGHT)
  }

  // vanilla renderStats：今日新增 / 错误数 / 告警数
  const stats = useMemo(() => {
    const today = dateKey(new Date().toISOString())
    return {
      today,
      todayCount: rows.filter((r) => dateKey(r.time) === today).length,
      errorCount: rows.filter((r) => r.level === 'error').length,
      warnCount: rows.filter((r) => r.level === 'warn').length,
    }
  }, [rows])

  // vanilla renderAnchor：按过滤结果分组（含文案，随 locale 重算）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => buildDateGroups(filtered, t), [filtered, locale])
  const anchorItemsJson = useMemo(
    () =>
      JSON.stringify(
        groups.map((g) => ({
          href: `#logs-day-${g.date}`,
          title: `${g.label} (${g.date.slice(5)})`,
        })),
      ),
    [groups],
  )

  // vanilla oas-item：填充行单元格 + 行 click 打开详情
  useOasEvent<{ item: LogEntry; element: HTMLElement }>(vlistRef, 'oas-item', (detail) => {
    const { item, element } = detail
    element.querySelector<HTMLElement>('[data-col="time"]')!.textContent = formatTime(item.time)
    const tag = element.querySelector('oas-tag')!
    tag.textContent = levelLabel(item.level, t)
    tag.setAttribute('type', LEVEL_TAG[item.level])
    element.querySelector<HTMLElement>('[data-col="operator"]')!.textContent = item.operator
    element.querySelector<HTMLElement>('[data-col="action"]')!.textContent = item.action
    element.querySelector<HTMLElement>('[data-col="ip"]')!.textContent = item.IP
    element.addEventListener('click', () => {
      setSelected(item)
      setDetailOpen(true)
    })
  })

  // vanilla oas-scroll：按滚动位置高亮当天锚点
  useOasEvent(vlistRef, 'oas-scroll', () => {
    const viewport = (
      vlistRef.current as unknown as { shadowRoot: ShadowRoot } | null
    )?.shadowRoot.querySelector<HTMLElement>('.viewport')
    if (!viewport) return
    const index = Math.min(filtered.length - 1, Math.floor(viewport.scrollTop / ITEM_HEIGHT))
    const row = filtered[index]
    if (!row) return
    anchorRef.current?.setAttribute('active', `#logs-day-${dateKey(row.time)}`)
  })

  // vanilla anchor oas-click：按 href 反查分组行号 → 滚动 + 高亮
  useOasEvent<{ href: string }>(anchorRef, 'oas-click', (detail) => {
    const group = groups.find((g) => `#logs-day-${g.date}` === detail.href)
    if (!group) return
    scrollToIndex(group.index)
    anchorRef.current?.setAttribute('active', detail.href)
  })

  // vanilla 768px 断点：锚点方向 vertical/horizontal 切换
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // vanilla 过滤控件段：级别/关键词/日期范围变化 → applyFilter（过滤 effect 消费 state）
  useOasEvent<{ value: string }>(levelRef, 'oas-change', (d) => {
    setLevel((d.value || 'all') as LogLevel | 'all')
  })
  useOasEvent<{ value: string }>(keywordRef, 'oas-input', (d) => {
    setKeyword(d.value)
  })
  useOasEvent(keywordRef, 'oas-clear', () => {
    setKeyword('')
  })
  useOasEvent<{ value: string[] | string }>(dateRef, 'oas-change', (d) => {
    if (Array.isArray(d.value) && d.value.length === 2 && d.value[0] && d.value[1]) {
      setDateRange([d.value[0], d.value[1]])
    } else {
      setDateRange(null)
    }
  })

  // vanilla 详情弹窗关闭段：摘 visible + 清选中
  useOasEvent(modalRef, 'oas-cancel', () => {
    setDetailOpen(false)
    setSelected(null)
  })

  // vanilla 导出段：空列表仅提示；CSV 带 BOM
  const onExport = () => {
    if (filtered.length === 0) {
      appMessage.info(t('logs.noExportable'))
      return
    }
    const header = t('logs.exportHeader')
    const body = filtered.map((r) =>
      [r.time, levelLabel(r.level, t), r.operator, r.action, r.IP].join(','),
    )
    const csv = `\ufeff${[header, ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    appMessage.success(t('logs.exported', { count: filtered.length }))
  }

  const empty = filtered.length === 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.logs')}</h1>
          <p className="page-subtitle">{t('logs.subtitle')}</p>
        </div>
      </div>
      <div className="logs-stats" id="logs-stats">
        <oas-card className="stat-card">
          <div className="stat-label">{t('logs.stat.today')}</div>
          <div className="stat-value mono">{stats.todayCount}</div>
          <div className="stat-foot">{stats.today}</div>
        </oas-card>
        <oas-card className="stat-card">
          <div className="stat-label">{t('logs.stat.errors')}</div>
          <div className="stat-value mono" style={{ color: 'var(--oas-color-danger)' }}>
            {stats.errorCount}
          </div>
          <div className="stat-foot">{t('logs.stat.errorLevel')}</div>
        </oas-card>
        <oas-card className="stat-card">
          <div className="stat-label">{t('logs.stat.warns')}</div>
          <div className="stat-value mono" style={{ color: 'var(--oas-color-warning)' }}>
            {stats.warnCount}
          </div>
          <div className="stat-foot">{t('logs.stat.warnLevel')}</div>
        </oas-card>
      </div>
      <oas-card className="logs-card" title={t('logs.cardTitle')}>
        <div className="logs-toolbar" slot="extra">
          <oas-select
            ref={levelRef}
            data-testid="logs-level"
            placeholder={t('logs.toolbar.level')}
            clearable
            value={level}
            options={JSON.stringify(levelOptions(t))}
          />
          <oas-input
            ref={keywordRef}
            data-testid="logs-keyword"
            placeholder={t('logs.toolbar.keyword')}
            clearable
            prefix-icon="search"
          />
          <oas-date-picker
            ref={dateRef}
            data-testid="logs-date"
            type="daterange"
            placeholder={t('logs.toolbar.dateRange')}
          />
          <oas-button data-testid="logs-export" type="primary" icon="download" onClick={onExport}>
            {t('logs.export')}
          </oas-button>
        </div>
        <div className="logs-main">
          <div className="logs-list-wrap">
            <div className="logs-header">
              <span className="logs-h-time">{t('logs.th.time')}</span>
              <span className="logs-h-level">{t('logs.th.level')}</span>
              <span className="logs-h-operator">{t('logs.th.operator')}</span>
              <span className="logs-h-action">{t('logs.th.action')}</span>
              <span className="logs-h-ip">{t('logs.th.ip')}</span>
            </div>
            <div className="logs-list-body">
              <oas-virtual-list
                ref={vlistRef}
                data-testid="logs-list"
                id="logs-list"
                height="480"
                item-height={ITEM_HEIGHT}
                hidden={empty || undefined}
              >
                <template slot="item" dangerouslySetInnerHTML={{ __html: ITEM_TEMPLATE_HTML }} />
              </oas-virtual-list>
              <div className="logs-empty" id="logs-empty" hidden={!empty || undefined}>
                <oas-empty description={t('logs.empty')} />
              </div>
            </div>
          </div>
          <div className="logs-anchor-wrap">
            <oas-anchor
              ref={anchorRef}
              data-testid="logs-anchor"
              id="logs-anchor"
              direction={compact ? 'horizontal' : 'vertical'}
              hash="false"
              items={anchorItemsJson}
            />
          </div>
        </div>
      </oas-card>
      <oas-modal
        ref={modalRef}
        data-testid="logs-detail"
        id="logs-detail"
        title={t('logs.detailTitle')}
        no-footer
        visible={detailOpen}
      >
        <div className="logs-detail-body" id="logs-detail-body">
          <oas-descriptions column="1">
            <oas-descriptions-item label={t('logs.dl.id')}>
              <span className="mono">{selected?.id ?? ''}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('logs.th.time')}>
              <span className="mono">{selected?.time ?? ''}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('logs.th.level')}>
              <oas-tag type={selected ? LEVEL_TAG[selected.level] : 'default'}>
                {selected ? levelLabel(selected.level, t) : ''}
              </oas-tag>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('logs.th.operator')}>
              {selected?.operator ?? ''}
            </oas-descriptions-item>
            <oas-descriptions-item label={t('logs.th.action')}>
              {selected?.action ?? ''}
            </oas-descriptions-item>
            <oas-descriptions-item label={t('logs.th.ip')}>
              <span className="mono">{selected?.IP ?? ''}</span>
            </oas-descriptions-item>
          </oas-descriptions>
        </div>
      </oas-modal>
    </div>
  )
}
