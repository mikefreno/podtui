import { render } from "@opentui/solid"
import { App } from "./App"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider, Toast } from "./ui/toast"
import { KeybindProvider } from "./context/KeybindContext"
import { DialogProvider } from "./ui/dialog"
import { CommandProvider } from "./ui/command"

render(() => (
  <ToastProvider>
    <ThemeProvider mode="dark">
      <KeybindProvider>
        <DialogProvider>
          <CommandProvider>
            <App />
            <Toast />
          </CommandProvider>
        </DialogProvider>
      </KeybindProvider>
    </ThemeProvider>
  </ToastProvider>
))
