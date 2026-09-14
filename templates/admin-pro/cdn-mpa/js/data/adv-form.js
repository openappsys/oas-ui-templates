// 高级表单数据模块：座机联想 / 地区级联 / 树选择选项（自 vanilla src/data/adv-form.ts 去 TS 移植）

const PHONES = [
  { label: '010-88886666', value: '010-88886666' },
  { label: '021-66668888', value: '021-66668888' },
  { label: '0755-33335555', value: '0755-33335555' },
]

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

// 每次返回深拷贝，避免调用方改动污染常量
export function advFormData() {
  return {
    phones: PHONES.map((p) => ({ ...p })),
    regions: structuredClone(REGIONS),
    treeRegions: structuredClone(TREE_REGIONS),
  }
}
