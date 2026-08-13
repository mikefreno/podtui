import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { batch, createContext, Show, useContext, type JSX, type ParentProps } from "solid-js"
import { useTheme } from "../context/ThemeContext"
import { RGBA, Renderable } from "@opentui/core"
import { createStore } from "solid-js/store"
import { Clipboard } from "../utils/clipboard"
import { useToast } from "./toast"
import { emit } from "../utils/event-bus"

export type DialogSize = "medium" | "large"

/**
 * Dialog component that renders a modal overlay with content.
 */
function Dialog(
  props: ParentProps<{
    size?: DialogSize
    onClose: () => void
  }>,
) {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const renderer = useRenderer()

  return (
    <box
      onMouseUp={async () => {
        if (renderer.getSelection()) return
        props.onClose?.()
      }}
      width={dimensions().width}
      height={dimensions().height}
      alignItems="center"
      position="absolute"
      paddingTop={Math.floor(dimensions().height / 4)}
      left={0}
      top={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
    >
      <box
        onMouseUp={async (e) => {
          if (renderer.getSelection()) return
          e.stopPropagation()
        }}
        width={props.size === "large" ? 80 : 60}
        maxWidth={dimensions().width - 2}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        borderColor={theme.border}
      >
        {props.children}
      </box>
    </box>
  )
}

type DialogStackItem = {
  element: JSX.Element
  onClose?: () => void
}

function init() {
  const [store, setStore] = createStore({
    stack: [] as DialogStackItem[],
    size: "medium" as DialogSize,
  })

  const renderer = useRenderer()
  let focus: Renderable | null = null

  function refocus() {
    setTimeout(() => {
      if (!focus) return
      if (focus.isDestroyed) return
      function find(item: Renderable): boolean {
        for (const child of item.getChildren()) {
          if (child === focus) return true
          if (find(child)) return true
        }
        return false
      }
      const found = find(renderer.root)
      if (!found) return
      focus.focus()
    }, 1)
  }

  useKeyboard((evt) => {
    if (evt.name === "escape" && store.stack.length > 0) {
      const current = store.stack.at(-1)!
      current.onClose?.()
      setStore("stack", store.stack.slice(0, -1))
      evt.preventDefault()
      evt.stopPropagation()
      refocus()
      emit("dialog.close", {})
    }
  })

  return {
    clear() {
      for (const item of store.stack) {
        if (item.onClose) item.onClose()
      }
      batch(() => {
        setStore("size", "medium")
        setStore("stack", [])
      })
      refocus()
      emit("dialog.close", {})
    },

    replace(input: JSX.Element | (() => JSX.Element), onClose?: () => void) {
      if (store.stack.length === 0) {
        focus = renderer.currentFocusedRenderable
        focus?.blur()
      }
      for (const item of store.stack) {
        if (item.onClose) item.onClose()
      }
      const element = typeof input === "function" ? input() : input
      setStore("size", "medium")
      setStore("stack", [{ element, onClose }])
      emit("dialog.open", { dialogId: "dialog" })
    },

    push(input: JSX.Element | (() => JSX.Element), onClose?: () => void) {
      if (store.stack.length === 0) {
        focus = renderer.currentFocusedRenderable
        focus?.blur()
      }
      const element = typeof input === "function" ? input() : input
      setStore("stack", [...store.stack, { element, onClose }])
      emit("dialog.open", { dialogId: "dialog" })
    },

    pop() {
      if (store.stack.length === 0) return
      const current = store.stack.at(-1)!
      current.onClose?.()
      setStore("stack", store.stack.slice(0, -1))
      if (store.stack.length === 0) {
        refocus()
      }
      emit("dialog.close", {})
    },

    get stack() {
      return store.stack
    },

    get size() {
      return store.size
    },

    setSize(size: DialogSize) {
      setStore("size", size)
    },

    get isOpen() {
      return store.stack.length > 0
    },
  }
}

export type DialogContext = ReturnType<typeof init>

const ctx = createContext<DialogContext>()

/**
 * DialogProvider wraps the application and provides dialog functionality.
 * Also handles clipboard copy on text selection within dialogs.
 */
export function DialogProvider(props: ParentProps) {
  const value = init()
  const renderer = useRenderer()
  const toast = useToast()

  return (
    <ctx.Provider value={value}>
      {props.children}
      <box
        position="absolute"
        onMouseUp={async () => {
          const text = renderer.getSelection()?.getSelectedText()
          if (text && text.length > 0) {
            await Clipboard.copy(text)
              .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
              .catch(toast.error)
            renderer.clearSelection()
          }
        }}
      >
        <Show when={value.stack.length > 0}>
          <Dialog onClose={() => value.clear()} size={value.size}>
            {value.stack.at(-1)!.element}
          </Dialog>
        </Show>
      </box>
    </ctx.Provider>
  )
}

/**
 * Hook to access the dialog context.
 */
export function useDialog() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useDialog must be used within a DialogProvider")
  }
  return value
}
