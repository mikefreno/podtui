import type { JSX } from "solid-js"

type LayoutProps = {
  header?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element
}

export function Layout(props: LayoutProps) {
  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      {props.header ? <box style={{ height: 3 }}>{props.header}</box> : <text></text>}
      <box style={{ flexGrow: 1 }}>{props.children}</box>
      {props.footer ? <box style={{ height: 1 }}>{props.footer}</box> : <text></text>}
    </box>
  )
}
