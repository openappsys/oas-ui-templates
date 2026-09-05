export type ErrorContext = 'router-load' | 'router-render' | 'http' | 'page' | 'unknown'

export interface ErrorReport {
  message: string
  context: ErrorContext
  timestamp: number
  stack?: string
  /** 附带上下文（如 url / 路由 path / http status） */
  detail?: Record<string, unknown>
}

export type ErrorReporter = (report: ErrorReport) => void

export const DEFAULT_REPORTER: ErrorReporter = (report) => {
  console.error(`[oas-admin] ${report.context}: ${report.message}`, report.detail ?? '')
  if (report.stack) console.error(report.stack)
}

let reporter: ErrorReporter = DEFAULT_REPORTER

/** 配置错误上报器（接监控 / Sentry 时替换）；传 null 恢复默认 console */
export function setErrorReporter(r: ErrorReporter | null): void {
  reporter = r ?? DEFAULT_REPORTER
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function errStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined
}

export function reportError(
  err: unknown,
  context: ErrorContext,
  detail?: Record<string, unknown>,
): void {
  reporter({
    message: errMessage(err),
    context,
    timestamp: Date.now(),
    stack: errStack(err),
    detail,
  })
}
