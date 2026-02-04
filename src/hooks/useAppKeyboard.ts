/**
 * Centralized keyboard shortcuts hook for PodTUI
 * Single handler to prevent conflicts
 */

import { useKeyboard, useRenderer } from "@opentui/solid"
import type { TabId } from "../components/Tab"

const TAB_ORDER: TabId[] = ["discover", "feeds", "search", "player", "settings"]

type ShortcutOptions = {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onAction?: (action: string) => void
  inputFocused?: boolean
}

export function useAppKeyboard(options: ShortcutOptions) {
  const renderer = useRenderer()

  const getNextTab = (current: TabId): TabId => {
    const idx = TAB_ORDER.indexOf(current)
    return TAB_ORDER[(idx + 1) % TAB_ORDER.length]
  }

  const getPrevTab = (current: TabId): TabId => {
    const idx = TAB_ORDER.indexOf(current)
    return TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]
  }

  useKeyboard((key) => {
    // Always allow quit
    if (key.ctrl && key.name === "q") {
      renderer.destroy()
      return
    }

    // Skip global shortcuts if input is focused (let input handle keys)
    if (options.inputFocused) {
      return
    }

    // Tab navigation with left/right arrows OR [ and ]
    if (key.name === "right" || key.name === "]") {
      options.onTabChange(getNextTab(options.activeTab))
      return
    }

    if (key.name === "left" || key.name === "[") {
      options.onTabChange(getPrevTab(options.activeTab))
      return
    }

    // Number keys for direct tab access (1-5)
    if (key.name === "1") {
      options.onTabChange("discover")
      return
    }
    if (key.name === "2") {
      options.onTabChange("feeds")
      return
    }
    if (key.name === "3") {
      options.onTabChange("search")
      return
    }
    if (key.name === "4") {
      options.onTabChange("player")
      return
    }
    if (key.name === "5") {
      options.onTabChange("settings")
      return
    }

    // Tab key cycles tabs (Shift+Tab goes backwards)
    if (key.name === "tab") {
      if (key.shift) {
        options.onTabChange(getPrevTab(options.activeTab))
      } else {
        options.onTabChange(getNextTab(options.activeTab))
      }
      return
    }

    // Forward other actions
    if (options.onAction) {
      if (key.ctrl && key.name === "s") {
        options.onAction("save")
      } else if (key.ctrl && key.name === "f") {
        options.onAction("find")
      } else if (key.name === "escape") {
        options.onAction("escape")
      } else if (key.name === "?" || (key.shift && key.name === "/")) {
        options.onAction("help")
      }
    }
  })
}
