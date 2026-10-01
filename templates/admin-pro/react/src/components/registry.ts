// 按需子路径注册（对齐 vanilla 模板 registry 模式）：
// '@oas-ui/ui' 全量入口会 define 全部组件，entry 体积不可接受；
// 这里仅注册本模板实际用到的组件（<oas-xxx> 标签 / createElement / message·modal API 全量盘点）。
// 注意：复合子元素（oas-checkbox-group/oas-descriptions-item/oas-list-item/oas-sider/
// oas-tab-panel/oas-timeline-item/oas-swatch-group 等）由对应主组件模块一并 define，无需单列。

// basic
import '@oas-ui/ui/basic/badge'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/basic/divider'
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/basic/space'
import '@oas-ui/ui/basic/tag'

// data
import '@oas-ui/ui/data/avatar'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/data/chart'
import '@oas-ui/ui/data/descriptions'
import '@oas-ui/ui/data/highlight'
import '@oas-ui/ui/data/list'
import '@oas-ui/ui/data/marquee'
import '@oas-ui/ui/data/number-animation'
import '@oas-ui/ui/data/statistic'
import '@oas-ui/ui/data/table'
import '@oas-ui/ui/data/timeline'
import '@oas-ui/ui/data/tree'
import '@oas-ui/ui/data/virtual-list'
import '@oas-ui/ui/data/watermark'

// feedback
import '@oas-ui/ui/feedback/drawer'
import '@oas-ui/ui/feedback/empty'
import '@oas-ui/ui/feedback/message'
import '@oas-ui/ui/feedback/modal'
import '@oas-ui/ui/feedback/popconfirm'
import '@oas-ui/ui/feedback/progress'
import '@oas-ui/ui/feedback/result'
import '@oas-ui/ui/feedback/skeleton'

// form
import '@oas-ui/ui/form/auto-complete'
import '@oas-ui/ui/form/cascader'
import '@oas-ui/ui/form/checkbox'
import '@oas-ui/ui/form/color-picker'
import '@oas-ui/ui/form/combobox'
import '@oas-ui/ui/form/date-picker'
import '@oas-ui/ui/form/dynamic-tags'
import '@oas-ui/ui/form/form'
import '@oas-ui/ui/form/form-item'
import '@oas-ui/ui/form/form-list'
import '@oas-ui/ui/form/input'
import '@oas-ui/ui/form/input-number'
import '@oas-ui/ui/form/pin-input'
import '@oas-ui/ui/form/radio'
import '@oas-ui/ui/form/rate'
import '@oas-ui/ui/form/segmented'
import '@oas-ui/ui/form/select'
import '@oas-ui/ui/form/slider'
import '@oas-ui/ui/form/swatch'
import '@oas-ui/ui/form/switch'
import '@oas-ui/ui/form/textarea'
import '@oas-ui/ui/form/transfer'
import '@oas-ui/ui/form/tree-select'
import '@oas-ui/ui/form/upload'

// framework
import '@oas-ui/ui/framework/theme-editor'

// layout
import '@oas-ui/ui/layout/layout'
import '@oas-ui/ui/layout/masonry'
import '@oas-ui/ui/layout/sidebar'
import '@oas-ui/ui/layout/splitter'

// navigation
import '@oas-ui/ui/navigation/anchor'
import '@oas-ui/ui/navigation/breadcrumb'
import '@oas-ui/ui/navigation/command'
import '@oas-ui/ui/navigation/dropdown'
import '@oas-ui/ui/navigation/menubar'
import '@oas-ui/ui/navigation/navigation-menu'
import '@oas-ui/ui/navigation/page-header'
import '@oas-ui/ui/navigation/pagination'
import '@oas-ui/ui/navigation/steps'
import '@oas-ui/ui/navigation/tabs'
