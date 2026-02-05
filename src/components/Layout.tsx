import type { JSX } from "solid-js"
import type { ThemeColors } from "../types/settings"
import type { ColorValue } from "../types/theme-schema"
import { resolveColorReference } from "../utils/theme-css"
import { LayerIndicator } from "./LayerIndicator"

type LayerConfig = {
  depth: number
  background: string
}

type LayoutProps = {
  header?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element
  theme?: ThemeColors
  layerDepth?: number
}

export function Layout(props: LayoutProps) {
  const theme = props.theme
  const toColor = (value?: ColorValue) => (value ? resolveColorReference(value) : undefined)

  // Get layer configuration based on depth
  const getLayerConfig = (depth: number): LayerConfig => {
    if (!theme?.layerBackgrounds) {
      return { depth: 0, background: "transparent" }
    }

    const backgrounds = theme.layerBackgrounds
    const depthMap: Record<number, LayerConfig> = {
      0: { depth: 0, background: resolveColorReference(backgrounds.layer0) },
      1: { depth: 1, background: resolveColorReference(backgrounds.layer1) },
      2: { depth: 2, background: resolveColorReference(backgrounds.layer2) },
      3: { depth: 3, background: resolveColorReference(backgrounds.layer3) },
    }

    return depthMap[depth] || { depth: 0, background: "transparent" }
  }

  // Get current layer background
  const currentLayer = getLayerConfig(props.layerDepth || 0)

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={toColor(theme?.background)}
    >
      {/* Header */}
      {props.header ? (
        <box
          style={{
            height: 4,
            backgroundColor: toColor(theme?.surface),
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
            backgroundColor: toColor(theme?.surface),
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
            backgroundColor: toColor(theme?.surface),
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
