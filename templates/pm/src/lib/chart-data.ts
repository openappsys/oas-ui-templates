export interface ChartSeriesData {
  labels: string[]
  series: Array<{ name: string; data: number[] }>
}

export function toChartData(
  name: string,
  points: Array<{ label: string; value: number }>,
): ChartSeriesData {
  return {
    labels: points.map((p) => p.label),
    series: [{ name, data: points.map((p) => p.value) }],
  }
}
