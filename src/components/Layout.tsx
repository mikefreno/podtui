import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import { Show, For, createMemo } from "solid-js"
import { useTheme } from "../context/ThemeContext"

type PanelConfig = {
  /** Panel content */
  content: JSX.Element
  /** Panel title shown in header */
  title?: string
  /** Fixed width (leave undefined for flex) */
  width?: number
  /** Whether this panel is currently focused */
  focused?: boolean
}

type LayoutProps = {
  /** Top tab bar */
  header?: JSX.Element
  /** Bottom status bar */
  footer?: JSX.Element
  /** Panels to display left-to-right like a file explorer */
  panels: PanelConfig[]
  /** Index of the currently active/focused panel */
  activePanelIndex?: number
}

export function Layout(props: LayoutProps) {
  const context = useTheme()

  const panelBg = (index: number): RGBA => {
    const backgrounds = context.theme.layerBackgrounds
    const layers = [
      backgrounds?.layer0 ?? context.theme.background,
      backgrounds?.layer1 ?? context.theme.backgroundPanel,
      backgrounds?.layer2 ?? context.theme.backgroundElement,
      backgrounds?.layer3 ?? context.theme.backgroundMenu,
    ]
    return layers[Math.min(index, layers.length - 1)]
  }

  const borderColor = (index: number): RGBA | string => {
    const isActive = index === (props.activePanelIndex ?? 0)
    return isActive
      ? (context.theme.accent ?? context.theme.primary)
      : (context.theme.border ?? context.theme.textMuted)
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={context.theme.background}
    >
      {/* Header - tab bar */}
      <Show when={props.header}>
        <box
          style={{
            height: 3,
            backgroundColor: context.theme.surface ?? context.theme.backgroundPanel,
          }}
        >
          <box style={{ paddingLeft: 1, paddingTop: 0, paddingBottom: 0 }}>
            {props.header}
          </box>
        </box>
      </Show>

      {/* Main content: side-by-side panels */}
      <box
        flexDirection="row"
        style={{ flexGrow: 1 }}
      >
        <For each={props.panels}>
          {(panel, index) => (
            <box
              flexDirection="column"
              border
              borderColor={borderColor(index())}
              backgroundColor={panelBg(index())}
              style={{
                flexGrow: panel.width ? 0 : 1,
                width: panel.width,
                height: "100%",
              }}
            >
              {/* Panel header */}
              <Show when={panel.title}>
                <box
                  style={{
                    height: 1,
                    paddingLeft: 1,
                    paddingRight: 1,
                    backgroundColor: index() === (props.activePanelIndex ?? 0)
                      ? (context.theme.accent ?? context.theme.primary)
                      : (context.theme.surface ?? context.theme.backgroundPanel),
                  }}
                >
                  <text
                    fg={index() === (props.activePanelIndex ?? 0) ? "black" : undefined}
                  >
                    <strong>{panel.title}</strong>
                  </text>
                </box>
              </Show>

              {/* Panel body */}
              <box
                style={{
                  flexGrow: 1,
                  padding: 1,
                }}
              >
                {panel.content}
              </box>
            </box>
          )}
        </For>
      </box>

      {/* Footer - status/nav bar */}
      <Show when={props.footer}>
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
    </box>
  )
}
