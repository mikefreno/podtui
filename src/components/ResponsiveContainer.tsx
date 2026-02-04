import { createMemo, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

type ResponsiveContainerProps = {
  children?: (size: "small" | "medium" | "large") => JSX.Element
}

export function ResponsiveContainer(props: ResponsiveContainerProps) {
  const dimensions = useTerminalDimensions()

  const size = createMemo<"small" | "medium" | "large">(() => {
    const width = dimensions().width
    if (width < 60) return "small"
    if (width < 100) return "medium"
    return "large"
  })

  return <>{props.children?.(size())}</>
}
