import { useRenderer } from "@opentui/solid"

export function LayerIndicator({ layerDepth }: { layerDepth: number }) {
  const renderer = useRenderer()

  const getLayerIndicator = () => {
    const indicators = []
    for (let i = 0; i < 4; i++) {
      const isActive = i <= layerDepth
      const color = isActive ? "#f6c177" : "#4c566a"
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
      <text fg="#7d8590" marginRight={1}>Depth:</text>
      {getLayerIndicator()}
      <text fg="#7d8590" marginLeft={1}>
        {layerDepth}
      </text>
    </box>
  )
}
