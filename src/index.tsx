// Hack: Force TERM to tmux-256color when running in tmux to enable
// correct palette detection in @opentui/core
if (process.env.TMUX && !process.env.TERM?.includes("tmux")) {
  process.env.TERM = "tmux-256color"
}

import { render, useRenderer } from "@opentui/solid"
import { App } from "./App"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider, Toast } from "./ui/toast"
import { KeybindProvider } from "./context/KeybindContext"
import { DialogProvider } from "./ui/dialog"
import { CommandProvider } from "./ui/command"

function RendererSetup(props: { children: unknown }) {
  const renderer = useRenderer()
  renderer.disableStdoutInterception()
  return props.children
}

render(() => (
  <RendererSetup>
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
  </RendererSetup>
))
