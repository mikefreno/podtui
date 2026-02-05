import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import { Show, createMemo } from "solid-js"
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
  const context = useTheme()

  // Get layer configuration based on depth - wrapped in createMemo for reactivity
  const currentLayer = createMemo((): LayerConfig => {
    const depth = props.layerDepth || 0
    const backgrounds = context.theme.layerBackgrounds
    const depthMap: Record<number, LayerConfig> = {
      0: { depth: 0, background: backgrounds?.layer0 ?? context.theme.background },
      1: { depth: 1, background: backgrounds?.layer1 ?? context.theme.backgroundPanel },
      2: { depth: 2, background: backgrounds?.layer2 ?? context.theme.backgroundElement },
      3: { depth: 3, background: backgrounds?.layer3 ?? context.theme.backgroundMenu },
    }

    return depthMap[depth] || { depth: 0, background: context.theme.background }
  })

  // Note: No need for a ready check here - the ThemeProvider uses
  // createSimpleContext which gates children rendering until ready
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={context.theme.background}
    >
      {/* Header */}
      <Show when={props.header} fallback={<box style={{ height: 4 }} />}>
        <box
          style={{
            height: 4,
            backgroundColor: context.theme.surface ?? context.theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            {props.header}
          </box>
        </box>
      </Show>

      {/* Main content area with layer background */}
      <box
        style={{
          flexGrow: 1,
          backgroundColor: currentLayer().background,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <box style={{ flexGrow: 1 }}>
          {props.children}
        </box>
      </box>

      {/* Footer */}
      <Show when={props.footer} fallback={<box style={{ height: 2 }} />}>
        <box
          style={{
            height: 2,
            backgroundColor: context.theme.surface ?? context.theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            {props.footer}
          </box>
        </box>
      </Show>

      {/* Layer indicator */}
      <Show when={props.layerDepth !== undefined}>
        <box
          style={{
            height: 1,
            backgroundColor: context.theme.surface ?? context.theme.backgroundPanel,
          }}
        >
          <box style={{ padding: 1 }}>
            <LayerIndicator layerDepth={props.layerDepth as number} />
          </box>
        </box>
      </Show>
    </box>
  )
}
