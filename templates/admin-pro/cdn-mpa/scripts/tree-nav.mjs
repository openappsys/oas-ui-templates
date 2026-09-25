/**
 * cdn-mpa 侧栏树形化：22 页内联 items JSON（扁平 3 项「菜单」组）改为
 * 分组父节点 + children（总览/业务，语义对齐全量模板），oas-sidebar 加 accordion。
 * 一次性迁移工具，执行后可删。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

const OLD_JSON =
  '[{"label":"仪表盘","value":"./dashboard.html","icon":"star","group":"菜单"},{"label":"用户管理","value":"./users.html","icon":"user","group":"菜单"},{"label":"创建订单","value":"./form.html","icon":"form","group":"菜单"}]'
const NEW_JSON =
  '[{"label":"总览","value":"nav.output","icon":"eye","children":[{"label":"仪表盘","value":"./dashboard.html","icon":"star"}]},{"label":"业务","value":"nav.business","icon":"organization","children":[{"label":"用户管理","value":"./users.html","icon":"user"},{"label":"创建订单","value":"./form.html","icon":"form"}]}]'

let changed = 0
for (const name of readdirSync(root)) {
  if (!name.endsWith('.html')) continue
  const p = join(root, name)
  let src = readFileSync(p, 'utf8')
  if (!src.includes('oas-sidebar')) continue
  const before = src
  src = src.replace(OLD_JSON, NEW_JSON)
  src = src.replace('<oas-sidebar id="nav" active=', '<oas-sidebar id="nav" accordion active=')
  if (src !== before) {
    writeFileSync(p, src)
    changed++
    console.log(`  ${name}`)
  }
}
console.log(`done: ${changed} pages`)
