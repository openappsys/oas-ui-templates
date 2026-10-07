// @ts-expect-error side-effect register (css-only package, no type entry)
import '@oas-ui/theme'
import '@oas-ui/theme/skins.css'
import '@oas-ui/theme/glass.css'
import '@oas-ui/icons'
import '@oas-ui/ui/data/card'
import '@oas-ui/ui/data/table'
import '@oas-ui/ui/data/chart'
import '@oas-ui/ui/layout/splitter'
import '@oas-ui/ui/form/slider'
import '@oas-ui/ui/basic/button'
import '@oas-ui/ui/basic/tag'
import '@oas-ui/ui/basic/icon'
import '@oas-ui/ui/form/input'
import '@oas-ui/ui/form/switch'
import '@oas-ui/ui/feedback/empty'
import './styles/app.css'

import { mountApp } from './app'

mountApp(document.querySelector<HTMLDivElement>('#app')!)
