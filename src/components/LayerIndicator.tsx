import { useRenderer } from "@opentui/solid"

export function LayerIndicator({ layerDepth }: { layerDepth: number }) {
  const renderer = useRenderer()

  const getLayerIndicator = () => {
    const indicators = []
    for (let i = 0; i < 4; i++) {
      const isActive = i <= layerDepth
      const color = isActive ? "var(--color-accent)" : "var(--color-muted)"
      const size = isActive ? "●" : "○"
      indicators.push(
        <text fg={color} marginRight={1}>
          {size}
        </text>
      )
    }
    return indicators
  }

  return (
    <box flexDirection="row" alignItems="center">
      <text fg="var(--color-muted)" marginRight={1}>Depth:</text>
      {getLayerIndicator()}
      <text fg="var(--color-muted)" marginLeft={1}>
        {layerDepth}
      </text>
    </box>
  )
}
