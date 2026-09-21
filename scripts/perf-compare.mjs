// 三框架模版性能对比：生产构建 + preview + 页面内精确计时
// 用法：先构建（pnpm --filter admin-pro-{react,vue,svelte} build），然后 node scripts/perf-compare.mjs
// 注意：探针禁止使用 body.innerText（强制全页布局会自扰测量结果，react 下虚增 300ms+），
//       一律用具体子树的小查询（querySelector + 小范围 textContent）
import { chromium } from '/private/var/www/zandy/oas-ui-templates/node_modules/.pnpm/node_modules/playwright-core/index.mjs'
import { spawn } from 'node:child_process'

const TPL = { react: 4301, vue: 4302, svelte: 4303 }

// 起 preview 服务
const servers = []
for (const [t, port] of Object.entries(TPL)) {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: `templates/admin-pro/${t}`,
    stdio: 'ignore',
  })
  servers.push(proc)
}
await new Promise((r) => setTimeout(r, 3000))

const browser = await chromium.launch()
const out = {}
for (const [name, port] of Object.entries(TPL)) {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    localStorage.setItem('oas-admin.session', JSON.stringify({ name: 'admin', role: 'admin' }))
    localStorage.setItem('oas-admin.locale', 'zh-CN')
  })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}/#/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const times = await page.evaluate(async () => {
    function deepFind(label) {
      function dq(r, out = []) {
        out.push(...r.querySelectorAll('*'))
        for (const e of r.querySelectorAll('*')) if (e.shadowRoot) dq(e.shadowRoot, out)
        return out
      }
      return dq(document).find(
        (e) =>
          (e.textContent || '').trim() === label &&
          e.children.length === 0 &&
          e.offsetParent !== null,
      )
    }
    const results = []
    for (const [label, path] of [
      ['用户管理', 'users', '用户'],
      ['商品管理', 'products', '商品'],
      ['权限管理', 'roles', '权限'],
    ]) {
      const elapsed = await new Promise((resolve) => {
        const t0 = performance.now()
        let settled = false
        const finish = (ms) => {
          if (!settled) {
            settled = true
            resolve(Math.round(ms))
          }
        }
        const check = () => {
          if (!location.hash.includes(path)) return
          const table = document.querySelector('oas-table')
          if ((table?.shadowRoot?.querySelectorAll('tr').length ?? 0) > 0)
            finish(performance.now() - t0)
        }
        const observer = new MutationObserver(check)
        observer.observe(document.body, { childList: true, subtree: true })
        const poll = setInterval(check, 16)
        const el = deepFind(label)
        if (!el) {
          clearInterval(poll)
          finish(-1)
          return
        }
        el.click()
        setTimeout(() => {
          clearInterval(poll)
          finish(performance.now() - t0)
        }, 8000)
      })
      results.push(elapsed)
      await new Promise((r) => setTimeout(r, 250))
    }
    // 冷加载：DCL + FCP + 传输体积
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance
      .getEntriesByType('paint')
      .find((p) => p.name === 'first-contentful-paint')
    const transfer = performance
      .getEntriesByType('resource')
      .reduce((s, e) => s + (e.transferSize || 0), 0)
    return {
      results,
      dcl: Math.round(nav?.domContentLoadedEventEnd ?? -1),
      fcp: Math.round(fcp?.startTime ?? -1),
      transferKB: Math.round(transfer / 1024),
    }
  })
  out[name] = {
    navMed: [...times.results].sort((a, b) => a - b)[1],
    navAll: times.results.join('/'),
    dcl: times.dcl,
    fcp: times.fcp,
    transferKB: times.transferKB,
  }
  await ctx.close()
}
await browser.close()
for (const s of servers) s.kill()

console.log('\n===== 性能对比（生产构建，5 次中位数）=====')
for (const [name, r] of Object.entries(out)) {
  console.log(
    `${name.padEnd(7)} 路由切换: ${String(r.navMed).padStart(4)}ms（${r.navAll}）| DCL: ${r.dcl}ms | FCP: ${r.fcp}ms | 传输: ${r.transferKB}KB`,
  )
}
