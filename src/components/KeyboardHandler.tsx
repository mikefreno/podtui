import type { JSX } from "solid-js"
import type { TabId } from "./Tab"

/**
 * @deprecated Use useAppKeyboard hook directly instead.
 * This component is kept for backwards compatibility.
 */
type KeyboardHandlerProps = {
  children?: JSX.Element
  onTabSelect?: (tab: TabId) => void
}

export function KeyboardHandler(props: KeyboardHandlerProps) {
  // Keyboard handling has been moved to useAppKeyboard hook
  // This component is now just a passthrough
  return <>{props.children}</>
}
