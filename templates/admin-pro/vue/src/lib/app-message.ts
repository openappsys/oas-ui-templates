// 组件库消息 API 唯一入口：window.OASMessage 不存在，必须具名 import
// destroyAll：result 页进入时清残留 toast（vanilla result.ts 同款）；
// 主入口未导出 destroyAll 类型，沿 vanilla 同款子路径导入
export { message as appMessage } from '@oas-ui/ui'
export { destroyAll } from '@oas-ui/ui/feedback/message'
