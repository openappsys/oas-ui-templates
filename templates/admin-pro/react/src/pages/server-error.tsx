// src/pages/server-error.tsx —— 500 服务器错误示例页
//    回退逻辑（history.length > 1 → back，否则去 /dashboard）逐字保留
// 3. 事件：两个按钮均为 light DOM 原生 click，直绑 onClick（不在 drawer/modal panel 内）
import { useNavigate } from 'react-router'
import { useT } from '../hooks/use-t'

export default function ServerErrorPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const goHome = () => navigate('/dashboard')
  const goBack = () => {
    if (history.length > 1) history.back()
    else navigate('/dashboard')
  }
  return (
    <div className="page notice">
      <oas-icon className="notice-icon notice-icon--error" name="error" size="28" />
      <div className="notice-code">500</div>
      <h1 className="notice-title">{t('common.500.title')}</h1>
      <p className="notice-desc">{t('common.500.desc')}</p>
      <div className="notice-actions">
        <oas-button type="default" variant="outlined" data-action="back" onClick={goBack}>
          {t('common.back')}
        </oas-button>
        <oas-button type="primary" data-action="home" onClick={goHome}>
          {t('common.home')}
        </oas-button>
      </div>
    </div>
  )
}
