// src/pages/dict-item-modal.tsx —— 字典键值弹窗（新增/编辑双态，表单事件自包含）
// 1. visible 由父组件 open 单一事实来源驱动；组件侧关闭（遮罩/Esc/✕）经 oas-close 回写
// 2. open 边沿逐字段 setAttribute 回填（编辑态带出当前值，sort 数字转字符串）
// 3. 面板内取消/保存按钮为 shadow panel 内原生 click（React 根委托收不到），例外直绑
//    addEventListener，经回调 ref 转发保证拿到最新 props
import { useEffect, useRef } from 'react'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla RULES_ITEM：标签/键值必填 */
function buildItemRules(t: TFunc): string {
  return JSON.stringify({
    label: [{ required: true, message: t('dict.rule.label') }],
    value: [{ required: true, message: t('dict.rule.value') }],
  })
}

export interface DictItemFormValues {
  label?: string
  value?: string
  sort?: string
}

export interface DictItemModalProps {
  open: boolean
  /** 编辑目标（null → 新建态） */
  editing: { label?: string; value?: string; sort?: number } | null
  onClose: () => void
  onSubmit: (values: DictItemFormValues) => void
}

export function DictItemModal({ open, editing, onClose, onSubmit }: DictItemModalProps) {
  const { t } = useT()
  const modalRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const labelRef = useRef<HTMLElement | null>(null)
  const valueRef = useRef<HTMLElement | null>(null)
  const sortRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)

  // 回调镜像：空依赖挂载的直绑监听经此拿到最新 onClose/onSubmit
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit

  useEffect(() => {
    if (!open) return
    labelRef.current?.setAttribute('value', editing?.label ?? '')
    valueRef.current?.setAttribute('value', editing?.value ?? '')
    sortRef.current?.setAttribute('value', editing ? String(editing.sort) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  // panel 内原生 click 例外直绑（取消=关闭；保存=触发内部原生 form 提交）
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => onCloseRef.current()
    const onSave = () => {
      ;(
        formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
      )?.requestSubmit()
    }
    cancel?.addEventListener('click', onCancel)
    save?.addEventListener('click', onSave)
    return () => {
      cancel?.removeEventListener('click', onCancel)
      save?.removeEventListener('click', onSave)
    }
  }, [])

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(modalRef, 'oas-close', () => onCloseRef.current())
  // 表单校验通过后的提交：值收集交给父组件编排
  useOasEvent<{ values: DictItemFormValues }>(formRef, 'oas-submit', (d) =>
    onSubmitRef.current(d.values),
  )

  return (
    <oas-modal ref={modalRef} data-testid="dict-item-modal" no-footer visible={open}>
      <div className="modal-body">
        <h2 id="dict-item-title">
          {editing == null ? t('dict.newItem') : t('dict.editItem', { label: editing.label ?? '' })}
        </h2>
        <oas-form ref={formRef} rules={buildItemRules(t)}>
          <div className="dict-form-body">
            <div className="form-field">
              <label className="form-label">
                {t('dict.form.label')} <span className="req">*</span>
              </label>
              <oas-input
                ref={labelRef}
                data-testid="dif-label"
                name="label"
                placeholder={t('dict.placeholder.label')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                {t('dict.form.value')} <span className="req">*</span>
              </label>
              <oas-input
                ref={valueRef}
                data-testid="dif-value"
                name="value"
                placeholder={t('dict.placeholder.value')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t('dict.form.sort')}</label>
              <oas-input-number
                ref={sortRef}
                data-testid="dif-sort"
                name="sort"
                min="0"
                placeholder="1"
              />
            </div>
            <div className="form-actions">
              <oas-space justify="end">
                <oas-button ref={cancelRef} data-testid="dif-cancel">
                  {t('common.cancel')}
                </oas-button>
                <oas-button ref={saveRef} data-testid="dif-save" type="primary">
                  {t('common.save')}
                </oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </div>
    </oas-modal>
  )
}
