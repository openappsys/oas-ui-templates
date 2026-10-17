const HEAD_WIDTHS = ['62%', '38%', '100%', '70%', '78%']

const ROW_WIDTHS = [
  ['96%', '88%', '100%', '86%', '92%'],
  ['97%', '72%', '100%', '90%', '80%'],
  ['98%', '94%', '100%', '76%', '96%'],
  ['99%', '64%', '100%', '92%', '72%'],
  ['95%', '82%', '100%', '68%', '88%'],
  ['94%', '56%', '100%', '84%', '89%'],
  ['93%', '90%', '100%', '80%', '76%'],
  ['92%', '70%', '100%', '74%', '86%'],
]

export function ListSkeleton() {
  return (
    <div className="skl-list" data-testid="list-skeleton" aria-hidden="true">
      <div className="skl-row skl-head">
        {HEAD_WIDTHS.map((w) => (
          <oas-skeleton key={w} rows="1" widths={w} effect="pulse" />
        ))}
      </div>
      {ROW_WIDTHS.map((row) => (
        <div key={row.join('-')} className="skl-row">
          {row.map((w) => (
            <oas-skeleton key={w} rows="1" widths={w} effect="pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
