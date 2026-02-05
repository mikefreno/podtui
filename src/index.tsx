import { render } from "@opentui/solid"
import { App } from "./App"
import { ThemeProvider } from "./context/ThemeContext"
import "./styles/theme.css"

render(() => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
))
