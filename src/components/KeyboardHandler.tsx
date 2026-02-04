import type { JSX } from "solid-js"
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts"
import type { TabId } from "./Tab"

type KeyboardHandlerProps = {
  children?: JSX.Element
  onTabSelect: (tab: TabId) => void
}

export function KeyboardHandler(props: KeyboardHandlerProps) {
  useKeyboardShortcuts({
    onTabNext: () => {
      props.onTabSelect("discover")
    },
    onTabPrev: () => {
      props.onTabSelect("settings")
    },
  })

  return <>{props.children}</>
}
