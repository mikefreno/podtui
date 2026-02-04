import { createSignal, onCleanup } from "solid-js"

type CacheOptions<T> = {
  fetcher: () => Promise<T>
  intervalMs?: number
}

export const useCachedData = <T,>(options: CacheOptions<T>) => {
  const [data, setData] = createSignal<T | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const value = await options.fetcher()
      setData(() => value)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  refresh()

  if (options.intervalMs) {
    const interval = setInterval(refresh, options.intervalMs)
    onCleanup(() => clearInterval(interval))
  }

  return { data, loading, error, refresh }
}
