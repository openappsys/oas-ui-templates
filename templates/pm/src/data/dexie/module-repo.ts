import { nanoid } from 'nanoid'
import { fromLiveQuery } from '@/data/observable'
import type { Module } from '@/types'
import type { ModuleRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'

/** 模块仓库（项目内 Issue 归类容器）。
 *  删除口径照 cycle-repo（同事务解绑）——不解绑会留悬空引用（里程碑曾经的 bug）；
 *  重名校验放 repo 层：同项目下同名模块会让侧栏/group-by 无法区分 */
export function createDexieModuleRepository(db: PMDatabase): ModuleRepository {
  const byNameAsc = (a: Module, b: Module) => a.name.localeCompare(b.name, 'zh-Hans-CN')
  const assertNameFree = async (projectId: string, name: string, excludeId?: string) => {
    const dup = await db.modules
      .where('projectId')
      .equals(projectId)
      .filter((m) => m.name === name && m.id !== excludeId)
      .count()
    if (dup > 0) throw new Error('同名模块已存在')
  }
  return {
    async all(projectId) {
      const rows = await db.modules.where('projectId').equals(projectId).toArray()
      return rows.sort(byNameAsc)
    },
    live(projectId) {
      return fromLiveQuery(() =>
        db.modules
          .where('projectId')
          .equals(projectId)
          .toArray()
          .then((rows) => rows.sort(byNameAsc)),
      )
    },
    async get(id) {
      return db.modules.get(id)
    },
    liveModuleCounts(projectId) {
      // 每模块在库 Issue 数（软删行不计）：projectId 作用域走复合索引，全部项目走单列
      return fromLiveQuery(async () => {
        const allProjects = projectId === '__all__'
        const mods = allProjects
          ? await db.modules.toArray()
          : await db.modules.where('projectId').equals(projectId).toArray()
        const out: Array<{ moduleId: string; total: number }> = []
        for (const m of mods) {
          const rows = allProjects
            ? await db.issues.where('moduleId').equals(m.id).toArray()
            : await db.issues.where('[projectId+moduleId]').equals([projectId, m.id]).toArray()
          out.push({ moduleId: m.id, total: rows.filter((r) => !r.deletedAt).length })
        }
        return out
      })
    },
    async create(input) {
      const name = input.name.trim()
      if (!name) throw new Error('模块名称不能为空')
      await assertNameFree(input.projectId, name)
      const m: Module = {
        id: nanoid(),
        projectId: input.projectId,
        name,
        description: input.description,
        leadId: input.leadId ?? null,
        createdAt: Date.now(),
      }
      await db.modules.add(m)
      return m
    },
    async update(id, changes) {
      const next = { ...changes }
      if (next.name !== undefined) {
        next.name = next.name.trim()
        if (!next.name) throw new Error('模块名称不能为空')
        const row = await db.modules.get(id)
        if (row) await assertNameFree(row.projectId, next.name, id)
      }
      await db.modules.update(id, next)
    },
    async delete(id) {
      // 同事务解除归属：模块没了 Issue 不能连带消失，退回「未分组」
      await db.transaction('rw', db.modules, db.issues, async () => {
        const owned = await db.issues.where('moduleId').equals(id).toArray()
        const now = Date.now()
        for (const issue of owned)
          await db.issues.update(issue.id, { moduleId: null, updatedAt: now })
        await db.modules.delete(id)
      })
    },
  }
}
