import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const TREND = [820, 932, 901, 1290, 1330, 1520, 1680]
const ORDERS = [120, 200, 150, 180, 220, 170, 210]
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const RECENT_ORDERS = [
  { id: 'SO-10086', customer: '华信科技', amount: '¥ 12,800', status: '已完成' },
  { id: 'SO-10085', customer: '蓝海贸易', amount: '¥ 8,600', status: '配送中' },
  { id: 'SO-10084', customer: '星野文化', amount: '¥ 3,200', status: '待支付' },
  { id: 'SO-10083', customer: '晨光实业', amount: '¥ 21,500', status: '已完成' },
  { id: 'SO-10082', customer: '云图软件', amount: '¥ 6,900', status: '已取消' },
]

function isDark(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

export function render(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">仪表盘</h1>
      <div class="stat-grid">
        <oas-card><oas-statistic data-testid="stat-visits" value="12480" prefix="今日访问"></oas-statistic></oas-card>
        <oas-card><oas-statistic value="328" prefix="新增用户"></oas-statistic></oas-card>
        <oas-card><oas-statistic value="1926" prefix="订单量"></oas-statistic></oas-card>
        <oas-card><oas-statistic value="4.6" suffix="%" prefix="转化率"></oas-statistic></oas-card>
      </div>
      <div class="chart-grid">
        <oas-card title="访问趋势"><div id="chart-trend" class="chart"></div></oas-card>
        <oas-card title="本周订单"><div id="chart-orders" class="chart"></div></oas-card>
      </div>
      <oas-card title="最近订单">
        <oas-table
          row-key="id"
          columns='[{"key":"id","title":"订单号"},{"key":"customer","title":"客户"},{"key":"amount","title":"金额"},{"key":"status","title":"状态"}]'
          data='${JSON.stringify(RECENT_ORDERS)}'
        ></oas-table>
      </oas-card>
    </div>`

  const charts: Array<echarts.ECharts> = []

  function draw(): void {
    for (const c of charts.splice(0)) c.dispose()
    const trend = el.querySelector<HTMLDivElement>('#chart-trend')
    const orders = el.querySelector<HTMLDivElement>('#chart-orders')
    if (trend) {
      const c = echarts.init(trend)
      c.setOption({
        darkMode: isDark(),
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 20, bottom: 24 },
        xAxis: { type: 'category', data: DAYS },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: TREND, smooth: true }],
      } as EChartsOption)
      charts.push(c)
    }
    if (orders) {
      const c = echarts.init(orders)
      c.setOption({
        darkMode: isDark(),
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 20, bottom: 24 },
        xAxis: { type: 'category', data: DAYS },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: ORDERS }],
      } as EChartsOption)
      charts.push(c)
    }
  }

  function onResize(): void {
    for (const c of charts) c.resize()
  }

  draw()
  window.addEventListener('resize', onResize)
  document.addEventListener('themechange', draw)

  return () => {
    window.removeEventListener('resize', onResize)
    document.removeEventListener('themechange', draw)
    for (const c of charts.splice(0)) c.dispose()
  }
}
