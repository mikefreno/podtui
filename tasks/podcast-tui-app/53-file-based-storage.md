# 52. Add Data Fetching and Caching

meta:
  id: podcast-tui-app-52
  feature: podcast-tui-app
  priority: P1
  depends_on: [51]
  tags: [data-fetching, caching, performance, solidjs]

objective:
- Implement data fetching with caching
- Cache podcast feeds and episodes
- Cache search results
- Cache popular shows
- Handle cache invalidation

deliverables:
- `src/utils/cache.ts` with cache management
- `src/utils/data-fetcher.ts` with data fetching logic
- `src/hooks/useCachedData.ts` with cache hook

steps:
- Create `src/utils/cache.ts`:
  - `cacheFeed(feedUrl: string, data: Feed): void`
  - `getCachedFeed(feedUrl: string): Feed | null`
  - `cacheSearch(query: string, results: Podcast[]): void`
  - `getCachedSearch(query: string): Podcast[] | null`
  - `invalidateCache(type: string): void`
  - `cacheExpiration = 3600000` (1 hour)
- Create `src/utils/data-fetcher.ts`:
  - `fetchFeedWithCache(feedUrl: string): Promise<Feed>`
  - `fetchEpisodesWithCache(feedUrl: string): Promise<Episode[]>`
  - `searchWithCache(query: string): Promise<Podcast[]>`
  - Use cache when available
- Create `src/hooks/useCachedData.ts`:
  - `createSignal` for cached data
  - Fetch data with cache
  - Update cache on fetch
  - Handle cache expiration

tests:
- Unit: Test cache management
- Unit: Test data fetcher
- Unit: Test cache hook

acceptance_criteria:
- Data is cached correctly
- Cache is used on subsequent requests
- Cache invalidation works
- Cache expiration handled

validation:
- Run application and fetch data
- Verify data is cached
- Make same request and use cache
- Test cache invalidation
- Test cache expiration

notes:
- Use localStorage for cache
- Cache feeds, episodes, search results
- Cache popular shows
- Invalidate cache on feed update
- Set cache expiration time
- Add cache size limit
- Clear cache on settings change
