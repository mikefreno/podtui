# 11. Implement Paginated Episode Fetching

meta:
  id: episode-infinite-scroll-11
  feature: episode-infinite-scroll
  priority: P2
  depends_on: [episode-infinite-scroll-10]
  tags: [rss, pagination, data-fetching]

objective:
- Fetch episodes in chunks with MAX_EPISODES_REFRESH limit
- Merge new episodes with existing list
- Maintain episode ordering (newest first)

deliverables:
- Paginated episode fetch function
- Episode list merging logic
- Integration with feed store

steps:
1. Create paginated fetch function in feed store
2. Implement chunk-based episode fetching (50 episodes at a time)
3. Add logic to merge new episodes with existing list
4. Maintain reverse chronological order (newest first)
5. Deduplicate episodes by title or URL

tests:
- Unit: Test paginated fetch logic
- Integration: Test with real RSS feeds
- Edge case: Test with feeds having < 50 episodes

acceptance_criteria:
- Episodes fetched in chunks of MAX_EPISODES_REFRESH
- New episodes merged correctly with existing list
- Episode ordering maintained (newest first)

validation:
- Test with RSS feed having 100+ episodes
- Verify pagination works correctly
- Check episode ordering after merge

notes:
- Use existing `MAX_EPISODES_REFRESH = 50` constant
- Add episode deduplication logic
- Preserve episode metadata during merge
- Handle cases where feed has fewer episodes
