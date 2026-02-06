# Episode List Infinite Scroll

Objective: Implement scroll-to-bottom loading for episode lists with MAX_EPISODES_REFRESH limit

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks
- [ ] 10 — Add scroll event listener to episodes panel → `10-episode-list-scroll-handler.md`
- [ ] 11 — Implement paginated episode fetching → `11-paginated-episode-loading.md`
- [ ] 12 — Manage episode list pagination state → `12-episode-list-state-management.md`
- [ ] 13 — Add loading indicator for pagination → `13-load-more-indicator.md`

Dependencies
- 10 -> 11
- 11 -> 12
- 12 -> 13

Exit criteria
- Episode list automatically loads more episodes when scrolling to bottom
- MAX_EPISODES_REFRESH is respected per fetch
- Loading state is properly displayed during pagination
