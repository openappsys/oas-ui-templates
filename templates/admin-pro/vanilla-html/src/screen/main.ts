import '@oas-ui/theme'
import '@oas-ui/theme/skins.css'
import '@oas-ui/icons/register'
// 组件子集：只注册大屏用到的（不 import 完整 registry.ts）
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/data/chart'
import '@oas-ui/ui/data/statistic'
import '@oas-ui/ui/data/number-animation'
import '@oas-ui/ui/feedback/progress'
import '@oas-ui/ui/data/watermark'
import { initI18n } from '../i18n'
import { renderScreen } from './screen'

initI18n()
document.documentElement.dataset.theme = 'dark'
const root = document.querySelector<HTMLDivElement>('#screen')!
renderScreen(root)
