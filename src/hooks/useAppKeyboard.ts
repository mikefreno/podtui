/**
 * Centralized keyboard shortcuts hook for PodTUI
 * Single handler to prevent conflicts
 */

import { useKeyboard, useRenderer } from "@opentui/solid"
import type { TabId } from "../components/Tab"
import type { Accessor } from "solid-js"

const TAB_ORDER: TabId[] = ["feed", "shows", "discover", "search", "player", "settings"]

type ShortcutOptions = {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onAction?: (action: string) => void
  inputFocused?: boolean
  navigationEnabled?: boolean
  layerDepth?: Accessor<number>
  onLayerChange?: (newDepth: number) => void
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

    if (key.name === "escape") {
      options.onAction?.("escape")
      return
    }

    // Skip global shortcuts if input is focused (let input handle keys)
    if (options.inputFocused) {
      return
    }

    if (options.navigationEnabled === false) {
      return
    }

    if (key.name === "enter") {
      options.onAction?.("enter")
      return
    }

    // Layer navigation with left/right arrows
    if (options.layerDepth !== undefined && options.onLayerChange) {
      const currentDepth = options.layerDepth()
      const maxLayers = 3

      if (key.name === "right") {
        if (currentDepth < maxLayers) {
          options.onLayerChange(currentDepth + 1)
        }
        return
      }

      if (key.name === "left") {
        if (currentDepth > 0) {
          options.onLayerChange(currentDepth - 1)
        }
        return
      }
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

    // Number keys for direct tab access (1-6)
    if (key.name === "1") {
      options.onTabChange("feed")
      return
    }
    if (key.name === "2") {
      options.onTabChange("shows")
      return
    }
    if (key.name === "3") {
      options.onTabChange("discover")
      return
    }
    if (key.name === "4") {
      options.onTabChange("search")
      return
    }
    if (key.name === "5") {
      options.onTabChange("player")
      return
    }
    if (key.name === "6") {
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
      } else if (key.name === "?" || (key.shift && key.name === "/")) {
        options.onAction("help")
      }
    }
  })
}
