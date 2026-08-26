# 接入真实后端

本模板默认跑在纯前端 demo 模式：一切数据来自本地 `localStorage` mock，`/api/*` 请求被 `enableFakeFetch()` 降级到本地内存哑数据。接真实后端分两层：**API 调用层**（走 `http` 请求）与**页面数据层**（内存 mock 数据源）。按需替换，非都要改。

## 1. 关闭本地 mock

`src/main.ts`：

```ts
initI18n()
// enableFakeFetch()   // ← 注释掉这行
```

`enableFakeFetch()` 把 `window.fetch` 里以 `/api/` 开头的请求劫持为本地哑数据。注释后，`http` 的所有请求将真正走网络。

## 2. 配置请求层

`src/api/http.ts` 的 `http` 单例：

```ts
export const http = createHttp({
  baseURL: '/api',   // ← 改成真实网关，如 'https://gateway.example.com/api'
  timeout: 8000,
  interceptors: [injectToken, onError],
})
```

- **baseURL**：指向真实接口前缀。同源可用 `/api`；跨域需网关 CORS 或走代理。
- **超时**：`timeout`（毫秒）。
- **拦截器**：
  - `injectToken` 从 `localStorage['oas-admin.session']` 读 token 注入 `Authorization: Bearer <token>`。若后端 token 字段/方案不同，改 `tokenFromSession()`。
  - `onError` 统一 toast 网络错误。要接监控可在 `request.ts` 的拦截器挂钩 `onError`。

## 3. 业务 API 示例（信封协议）

`src/api/auth.ts` 已演示「解析 `{ code, data, message }` 信封」模式：

```ts
export async function login(username: string, password: string): Promise<LoginApiResult> {
  const res = await http.request<Envelope<LoginApiResult>>({
    url: '/auth/login',
    method: 'POST',
    body: { username, password },
  })
  if (res.code !== 0) throw new Error(res.message ?? 'Login failed')
  return res.data
}
```

按此模式新增业务 API：新建 `src/api/xxx.ts`，用 `http.request<Envelope<T>>` 调接口，`code !== 0` 抛错。

## 4. 页面数据层替换

页面（`src/pages/*.ts`）目前从 `src/data/*.ts` 内存数据源取数（CRUD + 100ms 模拟延迟 + localStorage 持久化）。数据源导出一组一致接口：

```ts
listUsers(): Promise<UserRow[]>
createUser(data): Promise<UserRow>
updateUser(id, data): Promise<UserRow | null>
removeUser(id): Promise<boolean>
```

**接后端**：替换这些函数实现为调用 `src/api/*.ts`（保持签名不变），页面无需改动。

```ts
// src/data/users.ts 改为
import { http } from '../api/http'
import type { Envelope } from '../api/auth'

export function listUsers(): Promise<UserRow[]> {
  return http.request<Envelope<UserRow[]>>({ url: '/users' }).then((res) => res.data)
}
// createUser / updateUser / removeUser 同理，用 http.request
```

数据源文件对照：

| 文件 | 页面 | 对应资源 |
| --- | --- | --- |
| `src/data/users.ts` | 用户管理 `/users` | 用户 CRUD |
| `src/data/orders.ts` | 订单管理 `/orders` | 订单列表/状态流转 |
| `src/data/products.ts` | 商品管理 `/products` | 商品 CRUD/上下架 |
| `src/data/notifications.ts` | 通知中心 | 通知列表 |
| `src/data/system.ts` | 角色/菜单/部门/字典/日志 | RBAC 与系统配置 |

## 5. 会话与登录

- 登录态在 `src/store/session.ts`（localStorage 持久化 `oas-admin.session`）。接后端时改用登录接口返回的 token，见「业务 API 示例」。
- token 注入已由 `injectToken` 处理；401 拦截可加进 `request.ts` 拦截器（跳登录页）。

## 6. 说明

- demo 数据 localStorage 持久化，清除 storage（或各数据源的 `resetXxx()`）即重置回种子数据。
- 若某接口不想迁移（如日志中心），保留该 `data/xxx.ts` 的内存实现即可，两种模式可共存。
