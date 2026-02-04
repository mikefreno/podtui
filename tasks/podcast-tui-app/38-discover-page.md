# 37. Create Popular Shows Data Structure

meta:
  id: podcast-tui-app-37
  feature: podcast-tui-app
  priority: P1
  depends_on: [36]
  tags: [popular-shows, data, discovery, solidjs]

objective:
- Create data structure for popular shows
- Define podcast metadata
- Categorize shows by topic
- Include feed URLs and descriptions

deliverables:
- `src/data/popular-shows.ts` with popular podcasts data
- `src/types/popular-shows.ts` with data types
- `src/constants/categories.ts` with category definitions

steps:
- Create `src/types/popular-shows.ts`:
  - `PopularPodcast` interface (id, title, description, coverUrl, feedUrl, category, tags)
  - `Category` enum (Technology, Business, Science, Entertainment, Health, Education)
- Create `src/constants/categories.ts`:
  - List of all categories
  - Category descriptions
  - Sample podcasts per category
- Create `src/data/popular-shows.ts`:
  - Array of popular podcasts
  - Categorized by topic
  - Reverse chronological ordering
  - Include metadata for each show

tests:
- Unit: Test data structure compiles
- Unit: Test category definitions
- Integration: Test popular shows display

acceptance_criteria:
- Popular shows data structure defined
- Categories defined correctly
- Shows categorized properly
- Data ready for display

validation:
- Run `bun run build` to verify TypeScript
- Check data structure compiles
- Review data for completeness

notes:
- Popular shows data can be static or fetched
- If sources don't provide trending, use curated list
- Categories help users find shows by topic
- Include diverse range of shows
- Add RSS feed URLs for easy subscription
