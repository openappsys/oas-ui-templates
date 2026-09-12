<script lang="ts">
  // src/pages/login.svelte —— 登录页：双版式（split/glass）+ oas-form 本地直登
  // 版式查询参数的等价实现（react 版 useSearchParams 思路）：参数写在 location.search 段
  // 而非 hash 内——hash 模式下路由 currentPath() 只读 hash 段且 matchRoute 是精确匹配，
  // query 拼进 hash 会被判成未知路径弹 /not-found；写在 search 段则两种路由模式都不参与
  // 路径匹配。pushState 写 search 不触发 hashchange/popstate，路由层无感不重估；
  // 浏览器前进/后退（popstate）时回读 search 同步版式。
  // 事件直绑（Svelte 5 原生支持 kebab 自定义事件）：onoas-submit 绑 oas-form、
  // onoas-enter 绑 oas-input（两事件均 bubbles+composed，见 @oas-ui/core emit）；
  // split/glass 用 if/else 切换重挂载后监听随元素重建，无需 react 版根 div 委托技巧。
  // session.login() 后必须手动 navigate('/dashboard')：路由层不会因登录态自动跳走，
  // 而已登录路由表无 /login，不手动导航会白屏（react 版同款结论）。
  import "./login.css"
  import { useT } from "../lib/use-t.svelte"
  import { navigate } from "../router"
  import { appRoutes } from "../router/routes"
  import { session } from "../store/session"

  type LoginStyle = "split" | "glass"

  interface LoginSubmitDetail {
    values: { name: string; role?: string }
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  /** 版式初始值：读 URL ?style=（hash/history 两模式 query 均在 search 段） */
  function readLoginStyle(): LoginStyle {
    return new URLSearchParams(window.location.search).get("style") === "glass" ? "glass" : "split"
  }

  /** 版式写回 URL：pushState 留历史条目（对齐 react setSearchParams 默认 push） */
  function writeLoginStyle(next: LoginStyle): void {
    const url = new URL(window.location.href)
    url.searchParams.set("style", next)
    history.pushState(history.state, "", url.pathname + url.search + url.hash)
  }

  let style = $state<LoginStyle>(readLoginStyle())

  // 前进/后退回读版式（search 变化不触发路由事件，路由层不感知，页面自管）
  $effect(() => {
    const syncStyle = (): void => {
      style = readLoginStyle()
    }
    window.addEventListener("popstate", syncStyle)
    return () => window.removeEventListener("popstate", syncStyle)
  })

  function switchStyle(next: LoginStyle): void {
    writeLoginStyle(next)
    style = next
  }

  /** oas-form host（bind:this）：跨 shadow 拿内部 <form> requestSubmit */
  let formEl = $state<HTMLElement | null>(null)

  const requestSubmit = (): void => {
    const form = formEl?.shadowRoot?.querySelector("form") as HTMLFormElement | null
    form?.requestSubmit()
  }

  const onSubmit = (e: Event): void => {
    const values = (e as CustomEvent<LoginSubmitDetail>).detail.values
    session.login(values.name || "用户", values.role === "viewer" ? "viewer" : "admin")
    // 进首页前清掉版式查询参数（history 模式 navigate 换 pathname 天然剥离；hash 模式 search 会残留）
    const url = new URL(window.location.href)
    if (url.search) {
      url.search = ""
      history.replaceState(history.state, "", url.pathname + url.search + url.hash)
    }
    navigate(appRoutes[0].path)
  }

  // 纯数据走 JSON attribute（切语言随 $locale 重算，组件 observedAttributes 感知重读）
  const rules = $derived.by(() => {
    void $locale
    return JSON.stringify({ name: [{ required: true, message: t("login.rule.name") }] })
  })
  const roleOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t("users.role.admin"), value: "admin" },
      { label: t("profile.roleViewer"), value: "viewer" },
    ])
  })
</script>

{#snippet logoLight()}
  <span class="oas-logo oas-logo-light">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin Pro</span>
  </span>
{/snippet}

{#snippet formBlock()}
  <div class="login-head">
    {@render logoLight()}
  </div>
  <h2 class="login-title">{tt("login.welcome")}</h2>
  <p class="login-sub">{tt("login.subtitle")}</p>
  <oas-form id="login-form" bind:this={formEl} rules={rules} onoas-submit={onSubmit}>
    <div class="login-fields">
      <oas-input
        data-testid="login-name"
        name="name"
        placeholder={tt("login.namePlaceholder")}
        onoas-enter={requestSubmit}
      ></oas-input>
      <oas-select data-testid="login-role" name="role" value="admin" options={roleOptions}></oas-select>
      <oas-button data-testid="login-submit" type="primary" block onclick={requestSubmit}>
        {tt("login.submit")}
        <oas-icon name="arrow-right" size="14"></oas-icon>
      </oas-button>
    </div>
  </oas-form>
  <div class="login-divider"></div>
  <p class="login-tip">{tt("login.tip")}</p>
{/snippet}

{#if style === "glass"}
  <div class="login-glass">
    <div class="glass-card" data-theme="dark">
      {@render formBlock()}
    </div>
    <div class="glass-foot">
      <p class="glass-slogan">{tt("login.glassSlogan")}</p>
      <button class="link-btn link-btn-light" type="button" onclick={() => switchStyle("split")}>
        {tt("login.switchSplit")}
      </button>
    </div>
  </div>
{:else}
  <div class="login-split">
    <div class="login-brand">
      <div class="login-brand-main">
        {@render logoLight()}
        <h1>{tt("login.slogan")}</h1>
        <p>{tt("login.sloganSub")}</p>
        <div class="brand-stats">
          <div class="brand-stat">
            <span class="num">117</span>
            <span class="label">{tt("login.statComponents")}</span>
          </div>
          <div class="brand-stat">
            <span class="num">22KB</span>
            <span class="label">{tt("login.statBundle")}</span>
          </div>
          <div class="brand-stat">
            <span class="num">0</span>
            <span class="label">{tt("login.statFrameworks")}</span>
          </div>
        </div>
      </div>
      <pre class="brand-code">{`<oas-button type="primary">${tt("common.save")}</oas-button>`}</pre>
    </div>
    <div class="login-panel">
      <div class="login-card">
        {@render formBlock()}
        <button class="link-btn login-alt" type="button" onclick={() => switchStyle("glass")}>
          {tt("login.switchGlass")}
        </button>
      </div>
    </div>
  </div>
{/if}
