/**
 * svelte 模板 a11y 补充检查：静态元素上的 onclick 拦截。
 *
 * 背景：svelte-check 经 --compiler-warnings 全局豁免了 a11y_click_events_have_key_events /
 * a11y_no_static_element_interactions 两条规则（oas-* web component 的键盘交互与语义
 * 在组件 shadow DOM 内部实现，编译器不可见导致全部误报）。代价是新写的原生静态元素
 * <div onclick> 类真问题也失去拦截——本脚本把这部分捡回来：
 *
 *   - oas-* 宿主：放行（语义由组件库承担，误报源）
 *   - 原生交互元素（button/a/input/select/textarea/label/summary）：放行（天然可交互）
 *   - 带 role 属性的标签：放行（作者已显式考虑语义；交互 role 的焦点问题由
 *     svelte-check 未豁免的 a11y_interactive_supports_focus 等规则管）
 *   - 其余元素带 onclick：报错（应换交互元素或补键盘事件 + role）
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const ALLOWED = new Set([
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
])

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.name.endsWith('.svelte')) yield p
  }
}

const violations = []
for (const file of walk(join(root, 'src'))) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inBlock = false // 跳过 <script>/<style> 块——块内的 onclick 字样是 JS 不是模板属性
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inBlock) {
      if (line.includes('</script>') || line.includes('</style>')) inBlock = false
      continue
    }
    if (line.match(/<(script|style)\b/)) {
      inBlock = true
      continue
    }
    if (!line.includes('onclick')) continue
    // 向上找到该标签的起始行（当前行可能只是多行标签中的一个属性行）
    let start = i
    while (start > 0 && !lines[start].trimStart().startsWith('<')) start--
    const openTag = lines.slice(start, i + 1).join(' ')
    const tag = openTag.match(/<([a-z][a-z0-9-]*)/)?.[1]
    if (!tag) continue
    if (tag.startsWith('oas-') || ALLOWED.has(tag)) continue
    if (/\brole=/.test(openTag)) continue
    violations.push(
      `${file}:${i + 1}  <${tag} … onclick> —— 静态元素点击缺键盘可达性（换交互元素 / 补键盘事件 + role / 用 oas-* 组件）`,
    )
  }
}

if (violations.length > 0) {
  console.error('发现静态元素 onclick：')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}
console.log('a11y onclick check OK')
