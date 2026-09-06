<script setup lang="ts">
// src/pages/user-detail.vue —— 用户详情弹窗（头像 + 描述列表 + 权限标识 + 编辑/删除）
// 行为事实来源：vanilla-html/src/pages/users.ts 的 oas-row-click 段（详情回填）与
// renderPerms/delete-popconfirm 段（react 版 Task 9 并行中仍为占位，以 vanilla 为准）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 每次行点击 innerHTML 重建 oas-descriptions 再逐节点回填；本模版
//    声明式——详情字段由 user/roleName/permTags props 派生，oas-descriptions 结构静态写出
//    （节点 id 与 vanilla 逐字一致：detail-id/detail-name2/detail-email/detail-role/
//    detail-status-tag/detail-created）
// 2. 权限标签：vanilla renderPerms 拼 oas-tag innerHTML；本模版 v-for 渲染，
//    type=success/default 由 allowed 派生；空列表回落单个 users.nonePerm 标签（同款）
// 3. 删除：vanilla popconfirm oas-ok 里做 canMutate 校验 + removeUser + 关闭 + 刷新；
//    本模版 oas-ok 仅上抛 delete，校验/持久化/提示在父组件（编辑/新建同样父组件持有状态）
// 4. visible 受控：oas-close 上抛 close 回写父组件 state（user-form.vue 同款）
import { computed } from 'vue'
import type { UserRow } from '../data/users'
import { useT } from '../composables/use-t'

export interface PermTag {
  perm: string
  allowed: boolean
}

const props = defineProps<{
  open: boolean
  user: UserRow | null
  /** 角色显示名（父组件 roleName：roleId 命中角色表优先，否则本地化枚举标签） */
  roleName: string
  /** 角色标签配色（vanilla：roleId != null ? roleTagType(target) : tagTypeForRole(role)） */
  roleTagType: string
  permTags: PermTag[]
  canMutate: boolean
}>()
const emit = defineEmits<{
  close: []
  edit: []
  delete: []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const avatarText = computed(() => props.user?.name.charAt(0).toUpperCase() ?? '')
const statusLabel = computed(() => (props.user ? t(`users.status.${props.user.status}`) : ''))
// vanilla tagTypeForStatus
const statusTagType = computed(() => (props.user?.status === 'active' ? 'success' : 'danger'))
</script>

<template>
  <oas-modal
    data-testid="user-detail-modal"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="modal-body">
      <div class="detail-header">
        <oas-avatar id="detail-avatar" size="48">
          <span slot="fallback" id="detail-avatar-text">{{ avatarText }}</span>
        </oas-avatar>
        <div>
          <div id="detail-name" class="detail-name">{{ user?.name ?? '' }}</div>
          <oas-tag id="detail-role-tag" :type="roleTagType">{{ roleName }}</oas-tag>
        </div>
      </div>
      <oas-descriptions id="detail-desc" column="1">
        <oas-descriptions-item label="ID">
          <span id="detail-id">{{ user?.id ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('users.name')">
          <span id="detail-name2">{{ user?.name ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('users.email')">
          <span id="detail-email">{{ user?.email ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('users.role')">
          <span id="detail-role">{{ roleName }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('users.status')">
          <oas-tag id="detail-status-tag" :type="statusTagType">{{ statusLabel }}</oas-tag>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('users.created')">
          <span id="detail-created">{{ user?.created ?? '' }}</span>
        </oas-descriptions-item>
      </oas-descriptions>
      <oas-divider />
      <div class="detail-perms-title form-label">{{ t('users.perm') }}</div>
      <div id="detail-perms-list" class="detail-perms-list">
        <oas-tag v-if="permTags.length === 0" type="default">{{ t('users.nonePerm') }}</oas-tag>
        <oas-tag
          v-for="p in permTags"
          :key="p.perm"
          class="mono"
          :type="p.allowed ? 'success' : 'default'"
        >
          {{ p.perm }}
        </oas-tag>
      </div>
      <oas-space justify="end">
        <oas-button data-testid="detail-edit" type="primary" @click="emit('edit')">
          {{ t('common.edit') }}
        </oas-button>
        <oas-popconfirm id="delete-popconfirm" :title="t('users.confirmDelete')" @oas-ok="emit('delete')">
          <oas-button
            data-testid="detail-delete"
            type="danger"
            :disabled="canMutate ? null : ''"
            :title="canMutate ? null : t('common.noPerm')"
          >
            {{ t('common.delete') }}
          </oas-button>
        </oas-popconfirm>
      </oas-space>
    </div>
  </oas-modal>
</template>
