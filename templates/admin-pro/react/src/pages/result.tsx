// src/pages/result.tsx —— 表单结果页（成功/失败双态，sessionStorage 快照驱动）
// 行为事实来源：vanilla-html/src/pages/result.ts（75 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 快照消费时机：vanilla 在 render() 同步读 sessionStorage('form-result') 并立即 removeItem；
//    本模版在 useState 惰性初始化中做同样的事，但以模块级缓存保证 StrictMode 双渲染的两次
//    惰性初始化取同一份快照（首个实例已 removeItem，否则第二次初始化会读到 null 而误判
//    失败态），缓存于卸载清理时复位，再次进入页面取新快照
// 2. destroyAll：vanilla 在 render() 同步关闭遗留 message；本模版移到挂载 effect（时点稍晚，
//    可观察效果一致——进入结果页时清空历史消息）
// 3. 跳转：vanilla navigate('/orders'|'/form')（hash 模式）；本模版用 react-router navigate
//    （双模式均正确）。注意 /form 页面属后续批次落地，当前跳转会经路由兜底到 /not-found，
//    /form 路由落地后自然对齐
// 4. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换；本模版 useT() 订阅后整页
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
