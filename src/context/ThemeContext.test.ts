import { describe, expect, it } from "bun:test"
import { ThemeProvider } from "./ThemeContext"

describe("ThemeContext", () => {
  it("exports provider", () => {
    expect(typeof ThemeProvider).toBe("function")
  })
})
