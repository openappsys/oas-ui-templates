/** API 传输层的结构化错误：status 0 表示请求未到达服务端（网络/DNS 失败） */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 服务端错误体统一为 `{ error: string }`；取不到时返回 undefined 由调用方兜底文案 */
export function errorMessage(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined
  const error = (body as { error?: unknown }).error
  return typeof error === 'string' ? error : undefined
}
