import { useCallback, useRef, useState } from 'react'
import { login, type LoginResult } from '@/data/api/auth'
import { ApiError } from '@/data/api/errors'
import { t } from '@/i18n'

/** oas-form 的取值/校验入口（dist 契约：getValues / validate 为公开 API） */
interface OasFormEl extends HTMLElement {
  getValues?: () => Record<string, unknown>
  validate?: () => Promise<boolean>
}

/** 演示账号：mock seed 的固定邮箱（角色 = seed 里的 role） */
export const DEMO_ACCOUNTS = [
  { id: 'admin', email: 'user1@oas.dev', roleKey: 'adminRoleAdmin' },
  { id: 'member', email: 'user2@oas.dev', roleKey: 'adminRoleMember' },
  { id: 'viewer', email: 'user4@oas.dev', roleKey: 'adminRoleViewer' },
] as const

/**
 * API 模式登录页：无有效会话时全屏接管。
 * 口令统一为 `oas`（mock 只做演示认证）；三个快速登录按钮省去手输邮箱。
 */
export function LoginView({
  notice,
  onSignedIn,
}: {
  notice?: string
  onSignedIn: (result: LoginResult) => void
}) {
  const formRef = useRef<OasFormEl>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const submit = useCallback(
    async (preset?: { email: string; password: string }) => {
      if (busyRef.current) return
      setError('')
      let email = preset?.email
      let password = preset?.password
      if (email === undefined || password === undefined) {
        const form = formRef.current
        // 校验失败时 oas-form 自己渲染字段级错误（含双语 message），这里不再提示
        if (form?.validate && !(await form.validate())) return
        const values = form?.getValues?.() ?? {}
        email = String(values.email ?? '').trim()
        password = String(values.password ?? '')
      }
      if (!email) {
        setError(t('loginEmailRequired'))
        return
      }
      if (!password) {
        setError(t('loginPasswordRequired'))
        return
      }
      busyRef.current = true
      setBusy(true)
      try {
        onSignedIn(await login(email, password))
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0
        setError(status === 401 ? t('loginFailed') : t('loginNetworkError'))
        busyRef.current = false
        setBusy(false)
      }
    },
    [onSignedIn],
  )

  const rules = {
    email: [{ required: true, message: t('loginEmailRequired') }],
    password: [{ required: true, message: t('loginPasswordRequired') }],
  }

  return (
    <main className="login-page" data-testid="login-page" aria-label={t('loginTitle')}>
      <div
        className="login-card"
        onKeyDown={(e) => {
          // 内部输入框在 shadow 内，Enter 不回传到原生 form：在卡片层兜住回车提交
          if (e.key === 'Enter') void submit()
        }}
      >
        <div className="login-brand">
          <span className="tb-logo">OAS</span> PM
        </div>
        <h1 className="login-title">{t('loginTitle')}</h1>
        <p className="login-hint">{t('loginSubtitle')}</p>
        {notice && (
          <oas-alert type="warning" data-testid="login-notice">
            {notice}
          </oas-alert>
        )}
        <oas-form ref={formRef} rules={rules} layout="vertical" data-testid="login-form">
          <oas-form-item label={t('loginEmail')}>
            <oas-input name="email" data-testid="login-email" />
          </oas-form-item>
          <oas-form-item label={t('loginPassword')}>
            <oas-input name="password" type="password" show-password data-testid="login-password" />
          </oas-form-item>
        </oas-form>
        {error && (
          <oas-alert type="error" data-testid="login-error">
            {error}
          </oas-alert>
        )}
        <oas-button
          type="primary"
          block
          disabled={busy}
          data-testid="login-submit"
          onClick={() => void submit()}
        >
          {t('loginSubmit')}
        </oas-button>
        <div className="login-quick">
          <span className="login-quick-title">{t('loginQuick')}</span>
          {DEMO_ACCOUNTS.map((account) => (
            <oas-button
              key={account.id}
              size="small"
              disabled={busy}
              data-testid={`quick-login-${account.id}`}
              onClick={() => void submit({ email: account.email, password: 'oas' })}
            >
              {t(account.roleKey)}
            </oas-button>
          ))}
        </div>
      </div>
    </main>
  )
}
