import type { JSX } from "solid-js"
import type { ThemeColors } from "../types/settings"

type LayoutProps = {
  header?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element
  theme?: ThemeColors
}

export function Layout(props: LayoutProps) {
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={props.theme?.background}
    >
      {props.header ? <box style={{ height: 3 }}>{props.header}</box> : <text></text>}
      <box style={{ flexGrow: 1 }}>{props.children}</box>
      {props.footer ? <box style={{ height: 1 }}>{props.footer}</box> : <text></text>}
    </box>
  )
}
