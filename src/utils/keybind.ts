import type { ParsedKey } from "@opentui/core"

/**
 * Keyboard shortcut parsing and matching utilities.
 *
 * Supports key combinations like:
 * - "ctrl+c" - Control + c
 * - "alt+x" - Alt + x
 * - "shift+enter" - Shift + Enter
 * - "<leader>n" - Leader key followed by n
 * - "ctrl+shift+p" - Control + Shift + p
 */

export namespace Keybind {
  export interface Info {
    key: string
    ctrl: boolean
    alt: boolean
    shift: boolean
    meta: boolean
    leader: boolean
  }

  /**
   * Parse a keybind string into a structured Info object.
   *
   * Examples:
   * - "ctrl+c" -> { key: "c", ctrl: true, ... }
   * - "<leader>n" -> { key: "n", leader: true, ... }
   * - "alt+shift+x" -> { key: "x", alt: true, shift: true, ... }
   */
  export function parse(input: string): Info[] {
    if (!input) return []

    // Handle multiple keybinds separated by comma or space
    const parts = input.split(/[,\s]+/).filter(Boolean)

    return parts.map((part) => {
      const info: Info = {
        key: "",
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        leader: false,
      }

      // Check for leader key prefix
      if (part.startsWith("<leader>")) {
        info.leader = true
        part = part.substring(8) // Remove "<leader>"
      }

      // Split by + for modifiers
      const tokens = part.toLowerCase().split("+")

      for (const token of tokens) {
        switch (token) {
          case "ctrl":
          case "control":
            info.ctrl = true
            break
          case "alt":
          case "option":
            info.alt = true
            break
          case "shift":
            info.shift = true
            break
          case "meta":
          case "cmd":
          case "command":
          case "win":
          case "super":
            info.meta = true
            break
          default:
            // The last non-modifier token is the key
            info.key = token
        }
      }

      return info
    })
  }

  /**
   * Convert a ParsedKey event to a Keybind.Info.
   */
  export function fromParsedKey(evt: ParsedKey, leader: boolean = false): Info {
    // ParsedKey has ctrl, shift, meta but may not have alt directly
    // We need to check what properties are available
    const evtAny = evt as unknown as Record<string, unknown>
    return {
      key: evt.name?.toLowerCase() ?? "",
      ctrl: evt.ctrl ?? false,
      alt: (evtAny.alt as boolean) ?? false,
      shift: evt.shift ?? false,
      meta: evt.meta ?? false,
      leader,
    }
  }

  /**
   * Check if a keybind matches a parsed key event.
   */
  export function match(keybind: Info, evt: Info): boolean {
    return (
      keybind.key === evt.key &&
      keybind.ctrl === evt.ctrl &&
      keybind.alt === evt.alt &&
      keybind.shift === evt.shift &&
      keybind.meta === evt.meta &&
      keybind.leader === evt.leader
    )
  }

  /**
   * Convert a keybind Info to a display string.
   */
  export function toString(info: Info): string {
    const parts: string[] = []

    if (info.leader) parts.push("<leader>")
    if (info.ctrl) parts.push("Ctrl")
    if (info.alt) parts.push("Alt")
    if (info.shift) parts.push("Shift")
    if (info.meta) parts.push("Cmd")

    if (info.key) {
      // Capitalize special keys
      const displayKey = info.key.length === 1 ? info.key.toUpperCase() : capitalize(info.key)
      parts.push(displayKey)
    }

    return parts.join("+")
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * Default keybindings configuration.
 */
export const DEFAULT_KEYBINDS = {
  // Leader key (space by default)
  leader: "space",

  // Navigation
  tab_next: "tab",
  tab_prev: "shift+tab",

  // App commands
  command_list: "ctrl+p",
  help: "?",
  quit: "ctrl+c",

  // Session/content
  session_new: "<leader>n",
  session_list: "<leader>s",

  // Theme
  theme_list: "<leader>t",

  // Player
  player_play: "space",
  player_pause: "space",
  player_next: "n",
  player_prev: "p",
  player_seek_forward: "l",
  player_seek_backward: "h",

  // List navigation
  list_up: "k",
  list_down: "j",
  list_top: "g",
  list_bottom: "G",
  list_select: "enter",

  // Search
  search_focus: "/",
  search_clear: "escape",
}

export type KeybindsConfig = typeof DEFAULT_KEYBINDS
