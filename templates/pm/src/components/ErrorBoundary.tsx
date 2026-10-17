import { Component, type ReactNode } from 'react'
import { t } from '@/i18n'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary" data-testid="error-boundary">
          <oas-result status="error">
            <span slot="title">{t('errorTitle')}</span>
            <span slot="description">{this.state.error.message}</span>
          </oas-result>
          <oas-button type="primary" onClick={() => this.setState({ error: null })}>
            {t('errorRetry')}
          </oas-button>
        </div>
      )
    }
    return this.props.children
  }
}
