<script lang="ts">
  // 根组件：登录态分派在路由层完成（未登录仅 /login，已登录经守卫放行；
  // AppShell 布局壳在 Task 2 接入 RouterView）
  import RouterView from './router/RouterView.svelte'
</script>

<RouterView />
