const CARD_LABEL_WIDTHS = ['48%', '36%', '52%', '40%']
const CHART_TITLE_WIDTHS = ['34%', '28%']
const CHART_ROW_WIDTHS = ['88%', '72%', '94%', '62%', '80%', '50%']
const TREND_ROW_WIDTHS = ['96%', '84%', '70%', '90%', '58%']

export function DashSkeleton() {
  return (
    <div className="skl-dash" data-testid="dash-skeleton" aria-hidden="true">
      <div className="dash-cards">
        {CARD_LABEL_WIDTHS.map((w) => (
          <div key={w} className="dash-card skl-stat">
            <oas-skeleton rows="1" widths={w} effect="pulse" />
            <oas-skeleton rows="1" widths="56%" effect="pulse" />
          </div>
        ))}
      </div>
      <div className="dash-charts">
        {CHART_TITLE_WIDTHS.map((w) => (
          <div key={w} className="dash-chart-box skl-chart">
            <div className="skl-chart-title">
              <oas-skeleton rows="1" widths={w} effect="pulse" />
            </div>
            <oas-skeleton rows="6" widths={CHART_ROW_WIDTHS.join(',')} effect="pulse" />
          </div>
        ))}
      </div>
      <div className="dash-chart-box skl-chart skl-trend">
        <div className="skl-chart-title">
          <oas-skeleton rows="1" widths="26%" effect="pulse" />
        </div>
        <oas-skeleton rows="5" widths={TREND_ROW_WIDTHS.join(',')} effect="pulse" />
      </div>
    </div>
  )
}
