import { useKeyboard, useRenderer } from "@opentui/solid"

type ShortcutOptions = {
  onSave?: () => void
  onQuit?: () => void
  onTabNext?: () => void
  onTabPrev?: () => void
}

export function useKeyboardShortcuts(options: ShortcutOptions) {
  const renderer = useRenderer()

  useKeyboard((key) => {
    if (key.ctrl && key.name === "q") {
      if (options.onQuit) {
        options.onQuit()
      } else {
        renderer.destroy()
      }
      return
    }

    if (key.ctrl && key.name === "s") {
      options.onSave?.()
      return
    }

    if (key.name === "right") {
      options.onTabNext?.()
      return
    }

    if (key.name === "left") {
      options.onTabPrev?.()
    }
  })
}
