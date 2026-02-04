import type { JSX } from "solid-js"

type ColumnProps = {
  children?: JSX.Element
  gap?: number
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline"
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly"
  width?: number | "auto" | `${number}%`
  height?: number | "auto" | `${number}%`
  padding?: number
}

export function Column(props: ColumnProps) {
  return (
    <box
      style={{
        flexDirection: "column",
        gap: props.gap,
        alignItems: props.alignItems,
        justifyContent: props.justifyContent,
        width: props.width,
        height: props.height,
        padding: props.padding,
      }}
    >
      {props.children}
    </box>
  )
}
