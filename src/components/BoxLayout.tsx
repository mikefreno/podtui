import type { JSX } from "solid-js"

type BoxLayoutProps = {
  children?: JSX.Element
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse"
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly"
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline"
  gap?: number
  width?: number | "auto" | `${number}%`
  height?: number | "auto" | `${number}%`
  padding?: number
  margin?: number
  border?: boolean
  title?: string
}

export function BoxLayout(props: BoxLayoutProps) {
  return (
    <box
      style={{
        flexDirection: props.flexDirection,
        justifyContent: props.justifyContent,
        alignItems: props.alignItems,
        gap: props.gap,
        width: props.width,
        height: props.height,
        padding: props.padding,
        margin: props.margin,
      }}
      border={props.border}
      title={props.title}
    >
      {props.children}
    </box>
  )
}
