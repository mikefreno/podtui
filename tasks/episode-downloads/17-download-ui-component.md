# 17. Add Download Status in Episode List [x]

meta:
  id: episode-downloads-17
  feature: episode-downloads
  priority: P2
  depends_on: [episode-downloads-16]
  tags: [ui, downloads, display]

objective:
- Display download status for episodes
- Add download button to episode list
- Show download progress visually

deliverables:
- Download status indicator component
- Download button in episode list
- Progress bar for downloading episodes

steps:
1. Add download status field to EpisodeListItem
2. Create download button in MyShowsPage episodes panel
3. Display download status (none, queued, downloading, completed, failed)
4. Add download progress bar for downloading episodes
5. Test download status display

tests:
- Integration: Test download status display
- Visual: Verify download button and progress bar
- UX: Test download status changes

acceptance_criteria:
- Download status is visible in episode list
- Download button is accessible
- Progress bar shows download progress

validation:
- View episode list with download button
- Start download and watch status change
- Verify progress bar updates

notes:
- Reuse existing episode list UI from MyShowsPage
- Add download icon button next to episode title
- Show status text: "DL", "DWN", "DONE", "ERR"
- Use existing progress bar component for download progress
- Position download button in episode header
