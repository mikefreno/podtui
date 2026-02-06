# 18. Implement Per-Feed Auto-Download Settings [x]

meta:
  id: episode-downloads-18
  feature: episode-downloads
  priority: P2
  depends_on: [episode-downloads-17]
  tags: [settings, automation, downloads]

objective:
- Add per-feed auto-download settings
- Configure number of episodes to auto-download per feed
- Enable/disable auto-download per feed

deliverables:
- Auto-download settings in feed store
- Settings UI for per-feed configuration
- Auto-download trigger logic

steps:
1. Add autoDownload field to Feed type
2. Add autoDownloadCount field to Feed type
3. Add settings UI in FeedPage or MyShowsPage
4. Implement auto-download trigger logic
5. Test auto-download functionality

tests:
- Unit: Test auto-download trigger logic
- Integration: Test with multiple feeds
- Edge case: Test with feeds having fewer episodes

acceptance_criteria:
- Auto-download settings are configurable per feed
- Settings are saved to persistent storage
- Auto-download works correctly when enabled

validation:
- Configure auto-download for a feed
- Subscribe to new episodes and verify auto-download
- Test with multiple feeds

notes:
- Add settings in FeedPage or MyShowsPage
- Default: autoDownload = false, autoDownloadCount = 0
- Only download newest episodes (by pubDate)
- Respect MAX_EPISODES_REFRESH limit
- Add settings in feed detail or feed list
- Consider adding "auto-download all new episodes" setting
