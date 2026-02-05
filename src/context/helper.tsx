import { createContext, Show, useContext, type ParentProps } from "solid-js"

/**
 * Creates a simple context with automatic ready-state handling.
 *
 * This pattern ensures that child components are NOT rendered until the
 * context's `ready` property is true (or undefined, meaning no ready check needed).
 *
 * This prevents the "useX must be used within a XProvider" errors that occur
 * when child components try to use context values before the provider has
 * finished async initialization.
 *
 * Usage:
 * ```tsx
 * export const { use: useMyContext, provider: MyProvider } = createSimpleContext({
 *   name: "MyContext",
 *   init: (props: { someProp: string }) => {
 *     const [ready, setReady] = createSignal(false)
 *     // ... async initialization ...
 *     return {
 *       get ready() { return ready() },
 *       // ... other values
 *     }
 *   },
 * })
 * ```
 */
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string
  init: ((input: Props) => T) | (() => T)
}) {
  const ctx = createContext<T>()

  return {
    provider: (props: ParentProps<Props>) => {
      const init = input.init(props)
      // Use an arrow function accessor for the ready check to maintain reactivity.
      // The getter `init.ready` reads from a store, so wrapping it in an
      // accessor allows Solid to track changes reactively.
      return (
        // @ts-expect-error - ready may not exist on all context types
        <Show when={init.ready === undefined || init.ready}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      )
    },
    use() {
      const value = useContext(ctx)
      if (!value) throw new Error(`${input.name} context must be used within a context provider`)
      return value
    },
  }
}
