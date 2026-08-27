export interface Option {
  label: string
  value: string
}

export interface RegionNode extends Option {
  children?: RegionNode[]
}

export interface AdvFormData {
  phones: Option[]
  regions: RegionNode[]
  treeRegions: RegionNode[]
}

const PHONES: Option[] = [
  { label: '010-88886666', value: '010-88886666' },
  { label: '021-66668888', value: '021-66668888' },
  { label: '0755-33335555', value: '0755-33335555' },
]

const REGIONS: RegionNode[] = [
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

const TREE_REGIONS: RegionNode[] = [
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

export function advFormData(): AdvFormData {
  return {
    phones: PHONES.map((p) => ({ ...p })),
    regions: structuredClone(REGIONS),
    treeRegions: structuredClone(TREE_REGIONS),
  }
}
