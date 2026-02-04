type CacheEntry<T> = {
  value: T
  timestamp: number
}

const CACHE_KEY = "podtui_cache"
const DEFAULT_TTL = 1000 * 60 * 60

const loadCache = (): Record<string, CacheEntry<unknown>> => {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry<unknown>>) : {}
  } catch {
    return {}
  }
}

const saveCache = (cache: Record<string, CacheEntry<unknown>>) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

const cache = loadCache()

export const cacheValue = <T,>(key: string, value: T) => {
  cache[key] = { value, timestamp: Date.now() }
  saveCache(cache)
}

export const getCachedValue = <T,>(key: string, ttl = DEFAULT_TTL): T | null => {
  const entry = cache[key] as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) {
    delete cache[key]
    saveCache(cache)
    return null
  }
  return entry.value
}

export const invalidateCache = (prefix?: string) => {
  if (!prefix) {
    Object.keys(cache).forEach((key) => delete cache[key])
    saveCache(cache)
    return
  }

  Object.keys(cache)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => delete cache[key])
  saveCache(cache)
}
