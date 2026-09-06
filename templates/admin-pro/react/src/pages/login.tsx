// src/pages/login.tsx —— 登录页：双版式（split/glass）+ oas-form 本地直登
//    useSearchParams 读写（HashRouter 模式下查询串在 hash 内，location.search 恒为空），
//    setSearchParams 触发重渲染切换版式，不整页刷新
//    useOasEvent 绑在**页面根 div** 上（两事件均 bubbles+composed，见 @oas-ui/core emit），
//    根 div 在 split/glass 切换时被 React 复用（同位置同类型只换 className），监听器不丢；
//    若绑在 oas-form 上，切换版式后元素重挂载而 ref 对象不变，useEffect 不会重绑
//    取其 shadowRoot 内 <form> requestSubmit()（playground 实测模式）
//    后整页重渲染，rules/options 等 JSON attribute 随之重算
//    实测（Playwright 全流程）：路由层**不会**自动跳走——session.login() 触发 AppRouter
//    切到已登录分支后，当前 URL 仍是 /login，而已登录路由表不含 /login（匹配落空，
//    react-router 警告 "No routes matched location /login"，页面空白），必须手动 navigate
import { useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { session } from '../store/session'
import { appRoutes } from '../router/routes'

type LoginStyle = 'split' | 'glass'

interface LoginSubmitDetail {
  values: { name: string; role?: string }
}

function LogoLight() {
  return (
    <span className="oas-logo oas-logo-light">
      <span className="oas-logo-badge">OAS</span>
      <span className="oas-logo-word">OAS Admin Pro</span>
    </span>
  )
}

export default function LoginPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const style: LoginStyle = searchParams.get('style') === 'glass' ? 'glass' : 'split'
  // 根 div：split/glass 切换时 React 复用同一节点，oas 事件监听挂此处不丢
  const rootRef = useRef<HTMLDivElement>(null)

  const switchStyle = (next: LoginStyle) => {
    const params = new URLSearchParams(searchParams)
    params.set('style', next)
    setSearchParams(params)
  }

  // 跨 shadow 提交：oas-form 内部 <form> 在 shadowRoot 里
  const requestSubmit = () => {
    const host = rootRef.current?.querySelector<HTMLElement>('#login-form')
    const form = host?.shadowRoot?.querySelector('form') as HTMLFormElement | null
    form?.requestSubmit()
  }

  // 登录即本地直登 + 手动跳转（对齐 vanilla：navigate(routes[0].path)）
  useOasEvent<LoginSubmitDetail>(rootRef, 'oas-submit', (detail) => {
    const values = detail.values
    session.login(values.name || '用户', values.role === 'viewer' ? 'viewer' : 'admin')
    navigate(appRoutes[0].path, { replace: true })
  })
  // 输入框回车提交（vanilla 对所有 oas-input 绑 oas-enter，本页仅一个）
  useOasEvent(rootRef, 'oas-enter', requestSubmit)

  const rules = JSON.stringify({
    name: [{ required: true, message: t('login.rule.name') }],
  })
  const roleOptions = JSON.stringify([
    { label: t('users.role.admin'), value: 'admin' },
    { label: t('profile.roleViewer'), value: 'viewer' },
  ])

  // 与 vanilla formBlock() 逐行对齐
  const formBlock = (
    <>
      <div className="login-head">
        <LogoLight />
      </div>
      <h2 className="login-title">{t('login.welcome')}</h2>
      <p className="login-sub">{t('login.subtitle')}</p>
      <oas-form id="login-form" rules={rules}>
        <div className="login-fields">
          <oas-input
            data-testid="login-name"
            name="name"
            placeholder={t('login.namePlaceholder')}
          />
          <oas-select data-testid="login-role" name="role" value="admin" options={roleOptions} />
          <oas-button data-testid="login-submit" type="primary" block onClick={requestSubmit}>
            {t('login.submit')} <oas-icon name="arrow-right" size="14" />
          </oas-button>
        </div>
      </oas-form>
      <div className="login-divider" />
      <p className="login-tip">{t('login.tip')}</p>
    </>
  )

  if (style === 'glass') {
    return (
      <div ref={rootRef} className="login-glass">
        <div className="glass-card" data-theme="dark">
          {formBlock}
        </div>
        <div className="glass-foot">
          <p className="glass-slogan">{t('login.glassSlogan')}</p>
          <button
            className="link-btn link-btn-light"
            type="button"
            onClick={() => switchStyle('split')}
          >
            {t('login.switchSplit')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="login-split">
      <div className="login-brand">
        <div className="login-brand-main">
          <LogoLight />
          <h1>{t('login.slogan')}</h1>
          <p>{t('login.sloganSub')}</p>
          <div className="brand-stats">
            <div className="brand-stat">
              <span className="num">117</span>
              <span className="label">{t('login.statComponents')}</span>
            </div>
            <div className="brand-stat">
              <span className="num">22KB</span>
              <span className="label">{t('login.statBundle')}</span>
            </div>
            <div className="brand-stat">
              <span className="num">0</span>
              <span className="label">{t('login.statFrameworks')}</span>
            </div>
          </div>
        </div>
        <pre className="brand-code">{`<oas-button type="primary">${t('common.save')}</oas-button>`}</pre>
      </div>
      <div className="login-panel">
        <div className="login-card">
          {formBlock}
          <button className="link-btn login-alt" type="button" onClick={() => switchStyle('glass')}>
            {t('login.switchGlass')}
          </button>
        </div>
      </div>
    </div>
  )
}
