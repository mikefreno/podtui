import { createContext, useContext, type ParentProps, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useTheme } from "../context/ThemeContext"
import { useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { emit } from "../utils/event-bus"

export type ToastVariant = "info" | "success" | "warning" | "error"

export type ToastOptions = {
  title?: string
  message: string
  variant: ToastVariant
  duration?: number
}

const DEFAULT_DURATION = 5000

/**
 * Toast component that displays at the top-right of the screen.
 * NOTE: This component must be rendered INSIDE ThemeProvider since it uses useTheme().
 * The ToastProvider itself can be placed outside ThemeProvider if needed.
 */
export function Toast() {
  const toast = useToast()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const getVariantColor = (variant: ToastVariant) => {
    switch (variant) {
      case "success":
        return theme.success
      case "warning":
        return theme.warning
      case "error":
        return theme.error
      case "info":
      default:
        return theme.info
    }
  }

  return (
    <Show when={toast.currentToast}>
      {(current) => (
        <box
          position="absolute"
          justifyContent="center"
          alignItems="flex-start"
          top={2}
          right={2}
          maxWidth={Math.min(60, dimensions().width - 6)}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.backgroundPanel}
          borderColor={getVariantColor(current().variant)}
          border={["left", "right"]}
        >
          <box flexDirection="column">
            <Show when={current().title}>
              <text attributes={TextAttributes.BOLD} style={{ marginBottom: 1 }} fg={theme.text}>
                {current().title}
              </text>
            </Show>
            <text fg={theme.text} wrapMode="word" width="100%">
              {current().message}
            </text>
          </box>
        </box>
      )}
    </Show>
  )
}

function init() {
  const [store, setStore] = createStore({
    currentToast: null as ToastOptions | null,
  })

  let timeoutHandle: NodeJS.Timeout | null = null

  const toast = {
    show(options: ToastOptions) {
      const duration = options.duration ?? DEFAULT_DURATION
      setStore("currentToast", {
        title: options.title,
        message: options.message,
        variant: options.variant,
      })

      // Emit event for other listeners
      emit("toast.show", options)

      if (timeoutHandle) clearTimeout(timeoutHandle)
      timeoutHandle = setTimeout(() => {
        setStore("currentToast", null)
      }, duration)
    },
    error: (err: unknown) => {
      if (err instanceof Error) {
        return toast.show({
          variant: "error",
          message: err.message,
        })
      }
      toast.show({
        variant: "error",
        message: "An unknown error has occurred",
      })
    },
    info: (message: string, title?: string) => {
      toast.show({ variant: "info", message, title })
    },
    success: (message: string, title?: string) => {
      toast.show({ variant: "success", message, title })
    },
    warning: (message: string, title?: string) => {
      toast.show({ variant: "warning", message, title })
    },
    clear: () => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      setStore("currentToast", null)
    },
    get currentToast(): ToastOptions | null {
      return store.currentToast
    },
  }
  return toast
}

export type ToastContext = ReturnType<typeof init>

const ctx = createContext<ToastContext>()

/**
 * ToastProvider provides toast functionality.
 * NOTE: The Toast UI component is NOT rendered here - you must render <Toast /> 
 * separately inside your component tree, after ThemeProvider.
 */
export function ToastProvider(props: ParentProps) {
  const value = init()
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function useToast() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return value
}
