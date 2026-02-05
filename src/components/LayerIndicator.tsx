import { useTheme } from "../context/ThemeContext"

export function LayerIndicator({ layerDepth }: { layerDepth: number }) {
  const { theme } = useTheme()

  const getLayerIndicator = () => {
    const indicators = []
    for (let i = 0; i < 4; i++) {
      const isActive = i <= layerDepth
      const color = isActive ? theme.accent : theme.textMuted
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
      <text fg={theme.textMuted} marginRight={1}>Depth:</text>
      {getLayerIndicator()}
      <text fg={theme.textMuted} marginLeft={1}>
        {layerDepth}
      </text>
    </box>
  )
}
