import { createMemo } from "solid-js"
import type { ParsedKey, Renderable } from "@opentui/core"
import { createStore } from "solid-js/store"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { createSimpleContext } from "./helper"
import { Keybind, DEFAULT_KEYBINDS, type KeybindsConfig } from "../utils/keybind"

/**
 * Keybind context provider for managing keyboard shortcuts.
 *
 * Features:
 * - Leader key support (like vim's leader key)
 * - Configurable keybindings
 * - Key parsing and matching
 * - Display-friendly key representations
 */
export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: (props: { keybinds?: Partial<KeybindsConfig> }) => {
    // Merge default keybinds with custom keybinds
    const customKeybinds = props.keybinds ?? {}
    const mergedKeybinds = { ...DEFAULT_KEYBINDS, ...customKeybinds }

    const keybinds = createMemo(() => {
      const result: Record<string, Keybind.Info[]> = {}
      for (const [key, value] of Object.entries(mergedKeybinds)) {
        result[key] = Keybind.parse(value)
      }
      return result
    })

    const [store, setStore] = createStore({
      leader: false,
    })

    const renderer = useRenderer()

    let focus: Renderable | null = null
    let timeout: NodeJS.Timeout | undefined

    function leader(active: boolean) {
      if (active) {
        setStore("leader", true)
        focus = renderer.currentFocusedRenderable
        focus?.blur()
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
          if (!store.leader) return
          leader(false)
          if (!focus || focus.isDestroyed) return
          focus.focus()
        }, 2000) // Leader key timeout
        return
      }

      if (!active) {
        if (focus && !renderer.currentFocusedRenderable) {
          focus.focus()
        }
        setStore("leader", false)
      }
    }

    // Handle leader key
    useKeyboard(async (evt) => {
      // Don't intercept leader key when a text-editing renderable (input/textarea)
      // has focus — let it handle text input (including space for the leader key).
      const focused = renderer.currentFocusedRenderable
      if (focused && "insertText" in focused) return

      if (!store.leader && result.match("leader", evt)) {
        leader(true)
        return
      }

      if (store.leader && evt.name) {
        setImmediate(() => {
          if (focus && renderer.currentFocusedRenderable === focus) {
            focus.focus()
          }
          leader(false)
        })
      }
    })

    const result = {
      get all() {
        return keybinds()
      },
      get leader() {
        return store.leader
      },
      /**
       * Parse a keyboard event into a Keybind.Info.
       */
      parse(evt: ParsedKey): Keybind.Info {
        // Handle special case for Ctrl+Underscore (represented as \x1F)
        if (evt.name === "\x1F") {
          return Keybind.fromParsedKey({ ...evt, name: "_", ctrl: true }, store.leader)
        }
        return Keybind.fromParsedKey(evt, store.leader)
      },
      /**
       * Check if a keyboard event matches a registered keybind.
       */
      match(key: keyof KeybindsConfig, evt: ParsedKey): boolean {
        const keybind = keybinds()[key]
        if (!keybind) return false
        const parsed: Keybind.Info = result.parse(evt)
        for (const kb of keybind) {
          if (Keybind.match(kb, parsed)) {
            return true
          }
        }
        return false
      },
      /**
       * Get a display string for a registered keybind.
       */
      print(key: keyof KeybindsConfig): string {
        const first = keybinds()[key]?.at(0)
        if (!first) return ""
        const display = Keybind.toString(first)
        // Replace leader placeholder with actual leader key
        const leaderKey = keybinds().leader?.[0]
        if (leaderKey) {
          return display.replace("<leader>", Keybind.toString(leaderKey))
        }
        return display
      },
    }
    return result
  },
})
