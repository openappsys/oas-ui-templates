/**
 * 高级表单数据模块（自 vanilla src/data/adv-form.ts 去 TS 移植，逻辑与种子数据逐字保留）
 */

/** @typedef {{ label: string, value: string }} Option */
/** @typedef {Option & { children?: RegionNode[] }} RegionNode */
/** @typedef {{ phones: Option[], regions: RegionNode[], treeRegions: RegionNode[] }} AdvFormData */

/** @type {Option[]} */
const PHONES = [
  { label: '010-88886666', value: '010-88886666' },
  { label: '021-66668888', value: '021-66668888' },
  { label: '0755-33335555', value: '0755-33335555' },
]

/** @type {RegionNode[]} */
const REGIONS = [
  {
    label: '浙江',
    value: 'zj',
    children: [
      { label: '杭州', value: 'hz' },
      { label: '宁波', value: 'nb' },
    ],
  },
  {
    label: '江苏',
    value: 'js',
    children: [
      { label: '南京', value: 'nj' },
      { label: '苏州', value: 'sz' },
    ],
  },
]

/** @type {RegionNode[]} */
const TREE_REGIONS = [
  {
    label: '华东',
    value: 'east',
    children: [
      { label: '上海', value: 'sh' },
      { label: '浙江', value: 'zj' },
    ],
  },
  {
    label: '华南',
    value: 'south',
    children: [{ label: '广东', value: 'gd' }],
  },
]

/** @returns {AdvFormData} */
export function advFormData() {
  return {
    phones: PHONES.map((p) => ({ ...p })),
    regions: structuredClone(REGIONS),
    treeRegions: structuredClone(TREE_REGIONS),
  }
}
