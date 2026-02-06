/**
 * Simple event bus for inter-component communication.
 *
 * This provides a decoupled way for components to communicate without
 * direct dependencies. Components can publish events and subscribe to
 * events they're interested in.
 *
 * Usage:
 * ```tsx
 * // Subscribe to events
 * const unsub = EventBus.on("theme.changed", (data) => {
 *   console.log("Theme changed to:", data.theme)
 * })
 *
 * // Publish events
 * EventBus.emit("theme.changed", { theme: "dark" })
 *
 * // Cleanup
 * unsub()
 * ```
 */

type EventHandler<T = unknown> = (data: T) => void

// Export EventHandler type for external use
export type { EventHandler }

interface EventBusInstance {
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void
  once<T = unknown>(event: string, handler: EventHandler<T>): () => void
  off<T = unknown>(event: string, handler: EventHandler<T>): void
  emit<T = unknown>(event: string, data: T): void
  clear(): void
}

function createEventBus(): EventBusInstance {
  const handlers = new Map<string, Set<EventHandler>>()

  return {
    on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
      if (!handlers.has(event)) {
        handlers.set(event, new Set())
      }
      handlers.get(event)!.add(handler as EventHandler)

      // Return unsubscribe function
      return () => {
        this.off(event, handler)
      }
    },

    once<T = unknown>(event: string, handler: EventHandler<T>): () => void {
      const wrappedHandler: EventHandler<T> = (data) => {
        this.off(event, wrappedHandler)
        handler(data)
      }
      return this.on(event, wrappedHandler)
    },

    off<T = unknown>(event: string, handler: EventHandler<T>): void {
      const eventHandlers = handlers.get(event)
      if (eventHandlers) {
        eventHandlers.delete(handler as EventHandler)
        if (eventHandlers.size === 0) {
          handlers.delete(event)
        }
      }
    },

    emit<T = unknown>(event: string, data: T): void {
      const eventHandlers = handlers.get(event)
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          try {
            handler(data)
          } catch (error) {
            console.error(`Error in event handler for "${event}":`, error)
          }
        }
      }
    },

    clear(): void {
      handlers.clear()
    },
  }
}

// Singleton event bus instance
export const EventBus = createEventBus()

// Common event types for the application
export type AppEvents = {
  "theme.changed": { theme: string; mode: "dark" | "light" }
  "theme.mode.changed": { mode: "dark" | "light" }
  "theme.reload": {}
  "navigation.tab.changed": { tab: string; previousTab?: string }
  "navigation.layer.changed": { depth: number; previousDepth: number }
  "feed.subscribed": { feedId: string; feedUrl: string }
  "feed.unsubscribed": { feedId: string }
  "player.play": { episodeId: string }
  "player.pause": { episodeId: string }
  "player.stop": {}
  "auth.login": { userId: string }
  "auth.logout": {}
  "toast.show": { message: string; variant: "info" | "success" | "warning" | "error"; title?: string; duration?: number }
  "dialog.open": { dialogId: string }
  "dialog.close": { dialogId?: string }
  "command.execute": { command: string; args?: unknown }
  "clipboard.copied": { text: string }
  "selection.start": { x: number; y: number }
  "selection.end": { text: string }

  // Multimedia key events (emitted by useMultimediaKeys, consumed by useAudio)
  "media.toggle": {}
  "media.volumeUp": {}
  "media.volumeDown": {}
  "media.seekForward": {}
  "media.seekBackward": {}
  "media.speedCycle": {}
}

// Type-safe emit and on functions
export function emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
  EventBus.emit(event, data)
}

export function on<K extends keyof AppEvents>(
  event: K,
  handler: EventHandler<AppEvents[K]>
): () => void {
  return EventBus.on(event, handler)
}

export function once<K extends keyof AppEvents>(
  event: K,
  handler: EventHandler<AppEvents[K]>
): () => void {
  return EventBus.once(event, handler)
}

export function off<K extends keyof AppEvents>(
  event: K,
  handler: EventHandler<AppEvents[K]>
): void {
  EventBus.off(event, handler)
}
