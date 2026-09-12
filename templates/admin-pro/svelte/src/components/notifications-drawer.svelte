<script lang="ts">
  // src/components/notifications-drawer.svelte —— 通知中心抽屉
  // 数据状态由 AppShell 经 useNotifications() 持有一份（badge 与抽屉共享），本组件纯展示 + 事件上抛
  // Svelte 的 onclick 直绑元素本身（不走根委托），oas-drawer panel 对原生事件的 stopPropagation 不影响
  import { useT } from '../lib/use-t.svelte'
  import type { Notification } from '../data/notifications'

  interface Props {
    open: boolean
    items: Notification[]
    onClose: () => void
    onReadOne: (id: string) => void
    onReadAll: () => void
  }

  let { open, items, onClose, onReadOne, onReadAll }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const allRead = $derived(items.every((n) => n.read))

  // 组件侧关闭（遮罩/Esc/✕）→ 回写父级状态，保持 visible 属性单一事实来源
  function onDrawerClose(): void {
    onClose()
  }

  function onListClick(e: Event): void {
    const item = (e.target as HTMLElement).closest('oas-list-item')
    const id = item?.getAttribute('data-id')
    if (id) onReadOne(id)
  }
</script>

<oas-drawer
  id="notif-drawer"
  title={tt('header.notification')}
  placement="right"
  size="medium"
  no-footer
  visible={open ? '' : null}
  onoas-close={onDrawerClose}
>
  <div class="notif-content">
    <div id="notif-list" class="notif-list">
      <!-- 列表项点击已读：条目本身是 oas-list-item 交互元素，容器仅做委托，不重复绑键盘事件 -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-list split onclick={onListClick}>
        {#each items as n (n.id)}
          <oas-list-item
            class="notif-item"
            class:is-unread={!n.read}
            title={n.title}
            data-id={n.id}
          >
            <span slot="description" class="notif-desc">{n.desc}</span>
            <span slot="extra" class="notif-meta">
              <span class="notif-time">{n.time}</span>
            </span>
          </oas-list-item>
        {/each}
      </oas-list>
    </div>
    <div class="notif-foot">
      <button
        id="notif-readall"
        class="link-btn"
        type="button"
        disabled={allRead}
        onclick={onReadAll}
      >
        {allRead ? tt('header.allReadDone') : tt('header.allRead')}
      </button>
    </div>
  </div>
</oas-drawer>

<style>
  /* slot 内容（notif-desc 等）留在 light DOM，scoped 照常命中 */
  .notif-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .notif-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .notif-foot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: var(--oas-space-3);
    margin-top: var(--oas-space-2);
    border-top: 1px solid var(--oas-color-border);
  }
  .notif-item {
    cursor: pointer;
  }
  .notif-item:hover {
    background: var(--oas-color-bg-hover);
  }
  .notif-item.is-unread {
    background: color-mix(in srgb, var(--oas-color-primary) 7%, transparent);
  }
  .notif-item.is-unread:hover {
    background: color-mix(in srgb, var(--oas-color-primary) 13%, transparent);
  }
  .notif-item.is-unread::part(title) {
    font-weight: 600;
  }
  .notif-item.is-unread::part(title)::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--oas-color-primary);
    margin-inline-end: var(--oas-space-2);
    vertical-align: 1px;
  }
  .notif-desc {
    display: block;
    margin-top: var(--oas-space-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notif-meta {
    display: inline-flex;
    align-items: center;
    gap: var(--oas-space-2);
  }
  .notif-time {
    font-family: var(--app-mono);
    font-size: var(--oas-font-size-xs);
    color: var(--oas-color-text-secondary);
    white-space: nowrap;
  }
</style>
