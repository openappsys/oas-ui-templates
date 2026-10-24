import { useEffect, useRef, useState } from 'react'
import { t, type DictKey, type Lang } from '@/i18n'
import type { Member } from '@/types'
import { AVATAR_PALETTE } from '@/lib/colors'
import { OSelect } from './oas-wrappers'

/** 时区列表：模板内置常用项；真实产品由工作区/账号服务下发 */
const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

const ROLE_LABEL: Record<string, DictKey> = {
  admin: 'adminRoleAdmin',
  member: 'adminRoleMember',
  viewer: 'adminRoleViewer',
}

type InputEl = HTMLElement & { value?: string }

function roleText(role: string, name?: string): string {
  const key = ROLE_LABEL[role]
  return key ? t(key) : (name ?? role)
}

/**
 * 个人资料抽屉（账号级自助）：头像色、姓名、职位、时区、角色只读；
 * 「我的 Issues」直接切到我的视图。保存走 MemberRepository（Dexie/API 同一接口）。
 */
export function ProfileDrawer({
  open,
  member,
  roleName,
  lang,
  onLang,
  onClose,
  onSave,
  onMyIssues,
}: {
  open: boolean
  member: Member | undefined
  roleName?: string
  lang: Lang
  onLang: (lang: Lang) => void
  onClose: () => void
  onSave: (changes: Partial<Member>) => Promise<void>
  onMyIssues: () => void
}) {
  const drawerRef = useRef<HTMLElement>(null)
  const nameRef = useRef<InputEl>(null)
  const titleRef = useRef<InputEl>(null)
  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [color, setColor] = useState<string>(AVATAR_PALETTE[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    if (open) el.setAttribute('visible', '')
    else el.removeAttribute('visible')
  }, [open])

  useEffect(() => {
    if (!open || !member) return
    setError('')
    setTimezone(member.timezone ?? TIMEZONES[0])
    setColor(member.avatarColor)
    if (nameRef.current) nameRef.current.value = member.name
    if (titleRef.current) titleRef.current.value = member.title ?? ''
  }, [open, member])

  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    const onShut = () => closeRef.current()
    el.addEventListener('oas-close', onShut)
    return () => el.removeEventListener('oas-close', onShut)
  }, [])

  const save = async () => {
    if (saving || !member) return
    const name = (nameRef.current?.value ?? '').trim()
    if (!name) {
      setError(t('profileNameRequired'))
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave({
        name,
        title: (titleRef.current?.value ?? '').trim(),
        timezone,
        avatarColor: color,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <oas-drawer
      ref={drawerRef}
      className="profile-drawer"
      width="420px"
      no-footer
      data-testid="profile-drawer"
    >
      <div className="profile-body">
        <h2 className="profile-title">{t('profileTitle')}</h2>
        <p className="profile-hint">{t('profileHint')}</p>

        {member && (
          <div className="profile-head">
            <oas-avatar size={48} color={color} text={member.name[0]} />
            <div className="profile-head-meta">
              <strong>{member.name}</strong>
              <span>{member.email}</span>
              <span className="profile-role" data-testid="profile-role">
                {t('profileRole')}: {roleText(member.role, roleName)}
              </span>
            </div>
          </div>
        )}

        <div className="profile-field">
          <label htmlFor="profile-avatar-color">{t('profileAvatarColor')}</label>
          <div className="profile-colors" id="profile-avatar-color">
            {AVATAR_PALETTE.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`profile-color${c === color ? ' is-active' : ''}`}
                style={{ background: c }}
                aria-label={`${t('profileAvatarColor')} ${i + 1}`}
                aria-pressed={c === color}
                data-testid={`profile-color-${i}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="profile-field">
          <label htmlFor="profile-name">{t('profileName')}</label>
          <oas-input ref={nameRef} id="profile-name" data-testid="profile-name" />
        </div>

        <div className="profile-field">
          <label htmlFor="profile-email">{t('profileEmail')}</label>
          <oas-input
            id="profile-email"
            data-testid="profile-email"
            value={member?.email ?? ''}
            disabled=""
          />
        </div>

        <div className="profile-field">
          <label htmlFor="profile-title">{t('profileJobTitle')}</label>
          <oas-input
            ref={titleRef}
            id="profile-title"
            data-testid="profile-title"
            placeholder={t('profileJobTitlePlaceholder')}
          />
        </div>

        <div className="profile-field">
          <label htmlFor="profile-timezone">{t('profileTimezone')}</label>
          <OSelect
            testid="profile-timezone"
            ariaLabel={t('profileTimezone')}
            value={timezone}
            options={TIMEZONES.map((z) => ({ label: z, value: z }))}
            onChange={setTimezone}
          />
        </div>

        {/* 语言是账号级偏好：资料抽屉与设置菜单共用同一持久化 */}
        <div className="profile-field">
          <label htmlFor="profile-lang">{t('adminLanguage')}</label>
          <OSelect
            testid="profile-lang"
            ariaLabel={t('adminLanguage')}
            value={lang}
            options={[
              { label: '中文', value: 'zh' },
              { label: 'English', value: 'en' },
            ]}
            onChange={(v) => onLang(v === 'en' ? 'en' : 'zh')}
          />
        </div>

        {error && (
          <oas-alert type="error" size="small" data-testid="profile-error">
            {error}
          </oas-alert>
        )}

        <div className="profile-actions">
          <oas-button type="text" size="small" data-testid="profile-my-issues" onClick={onMyIssues}>
            {t('profileMyIssues')}
          </oas-button>
          <span className="profile-actions-gap" />
          <oas-button size="small" data-testid="profile-cancel" onClick={onClose}>
            {t('cancel')}
          </oas-button>
          <oas-button
            type="primary"
            size="small"
            data-testid="profile-save"
            disabled={saving ? '' : undefined}
            onClick={() => void save()}
          >
            {t('save')}
          </oas-button>
        </div>
      </div>
    </oas-drawer>
  )
}
