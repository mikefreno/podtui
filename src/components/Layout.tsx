import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import { useTheme } from "../context/ThemeContext"
import { LayerIndicator } from "./LayerIndicator"

type LayerConfig = {
  depth: number
  background: RGBA
}

type LayoutProps = {
  header?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element
  layerDepth?: number
}

export function Layout(props: LayoutProps) {
  const { theme } = useTheme()

  // Get layer configuration based on depth
  const getLayerConfig = (depth: number): LayerConfig => {
    const backgrounds = theme.layerBackgrounds
    const depthMap: Record<number, LayerConfig> = {
      0: { depth: 0, background: backgrounds?.layer0 ?? theme.background },
      1: { depth: 1, background: backgrounds?.layer1 ?? theme.backgroundPanel },
      2: { depth: 2, background: backgrounds?.layer2 ?? theme.backgroundElement },
      3: { depth: 3, background: backgrounds?.layer3 ?? theme.backgroundMenu },
    }

    return depthMap[depth] || { depth: 0, background: theme.background }
  }

  // Get current layer background
  const currentLayer = getLayerConfig(props.layerDepth || 0)

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.background}
    >
      {/* Header */}
      {props.header ? (
        <box
          style={{
            height: 4,
            backgroundColor: theme.surface ?? theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            {props.header}
          </box>
        </box>
      ) : (
        <box style={{ height: 4 }} />
      )}

      {/* Main content area with layer background */}
      <box
        style={{
          flexGrow: 1,
          backgroundColor: currentLayer.background,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <box style={{ flexGrow: 1 }}>
          {props.children}
        </box>
      </box>

      {/* Footer */}
      {props.footer ? (
        <box
          style={{
            height: 2,
            backgroundColor: theme.surface ?? theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            {props.footer}
          </box>
        </box>
      ) : (
        <box style={{ height: 2 }} />
      )}

      {/* Layer indicator */}
      {props.layerDepth !== undefined && (
        <box
          style={{
            height: 1,
            backgroundColor: theme.surface ?? theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            <LayerIndicator layerDepth={props.layerDepth} />
          </box>
        </box>
      )}
    </box>
  )
}
