// src/pages/result.tsx —— 表单结果页（成功/失败双态，sessionStorage 快照驱动）
//    本模版在 useState 惰性初始化中做同样的事，但以模块级缓存保证 StrictMode 双渲染的两次
//    惰性初始化取同一份快照（首个实例已 removeItem，否则第二次初始化会读到 null 而误判
//    失败态），缓存于卸载清理时复位，再次进入页面取新快照
//    可观察效果一致——进入结果页时清空历史消息）
//    （双模式均正确）。注意 /form 页面属后续批次落地，当前跳转会经路由兜底到 /not-found，
//    /form 路由落地后自然对齐
//    重渲染（快照已在挂载时固化，重渲染只换文案不重读 sessionStorage）
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { destroyAll } from '@oas-ui/ui/feedback/message'
import { useT } from '../hooks/use-t'

interface FormResult {
  success: boolean
  orderId: string
}

// StrictMode 双渲染共用快照（偏差记录 1）
let cachedResult: FormResult | null = null

function consumeFormResult(): FormResult {
  if (cachedResult) return cachedResult
  let success = false
  let orderId = ''
  try {
    const raw = sessionStorage.getItem('form-result')
    if (raw) {
      const data = JSON.parse(raw) as { status?: string; orderId?: string }
      success = data.status === 'success'
      orderId = data.orderId ?? ''
    }
  } catch {
    success = false
  }
  sessionStorage.removeItem('form-result')
  cachedResult = { success, orderId }
  return cachedResult
}

export default function ResultPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [result] = useState(consumeFormResult)

  // vanilla destroyAll：进入结果页清空遗留消息（卸载时复位快照缓存，见偏差记录 1/2）
  useEffect(() => {
    destroyAll()
    return () => {
      cachedResult = null
    }
  }, [])

  return (
    <div className="page result-page">
      <div className="result-wrap">
        {result.success ? (
          <oas-result
            data-testid="form-result"
            status="success"
            title={t('result.success.title')}
            description={t('result.success.desc', { orderId: result.orderId })}
          >
            <div slot="extra" className="result-actions">
              <oas-button
                data-testid="result-view-order"
                type="primary"
                onClick={() => navigate('/orders')}
              >
                {t('result.viewOrder')}
              </oas-button>
              <oas-button data-testid="result-reset" onClick={() => navigate('/form')}>
                {t('result.createAnother')}
              </oas-button>
            </div>
          </oas-result>
        ) : (
          <oas-result
            data-testid="form-result"
            status="error"
            title={t('result.error.title')}
            description={t('result.error.desc')}
          >
            <div slot="extra" className="result-actions">
              <oas-button
                data-testid="result-back-form"
                type="primary"
                onClick={() => navigate('/form')}
              >
                {t('result.backForm')}
              </oas-button>
            </div>
          </oas-result>
        )}
      </div>
    </div>
  )
}
