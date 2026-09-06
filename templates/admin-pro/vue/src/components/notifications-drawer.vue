<script setup lang="ts">
// src/components/notifications-drawer.vue —— 通知中心抽屉
// 数据状态由 AppShell 经 useNotifications() 持有一份（badge 与抽屉共享），本组件纯展示 + 事件上抛
// Vue 化差异（天然优势）：@click 直绑 panel 内元素本身（Vue 不用根委托），
// oas-drawer panel 对原生事件的 stopPropagation 不影响本组件内监听
import { computed } from 'vue'
import { useT } from '../composables/use-t'
import type { Notification } from '../data/notifications'

const props = defineProps<{
  open: boolean
  items: Notification[]
}>()
const emit = defineEmits<{
  close: []
  'read-one': [id: string]
  'read-all': []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const allRead = computed(() => props.items.every((n) => n.read))

// 组件侧关闭（遮罩/Esc/✕）→ 回写父级状态，保持 visible 属性单一事实来源
function onDrawerClose(): void {
  emit('close')
}

function onListClick(e: Event): void {
  const item = (e.target as HTMLElement).closest('oas-list-item')
  const id = item?.getAttribute('data-id')
  if (id) emit('read-one', id)
}
</script>

<template>
  <oas-drawer
    id="notif-drawer"
    :title="t('header.notification')"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="onDrawerClose"
  >
    <div class="notif-content">
      <div id="notif-list" class="notif-list">
        <oas-list split @click="onListClick">
          <oas-list-item
            v-for="n in items"
            :key="n.id"
            class="notif-item"
            :class="{ 'is-unread': !n.read }"
            :title="n.title"
            :data-id="n.id"
          >
            <span slot="description" class="notif-desc">{{ n.desc }}</span>
            <span slot="extra" class="notif-meta">
              <span class="notif-time">{{ n.time }}</span>
            </span>
          </oas-list-item>
        </oas-list>
      </div>
      <div class="notif-foot">
        <button
          id="notif-readall"
          class="link-btn"
          type="button"
          :disabled="allRead"
          @click="emit('read-all')"
        >
          {{ allRead ? t('header.allReadDone') : t('header.allRead') }}
        </button>
      </div>
    </div>
  </oas-drawer>
</template>
