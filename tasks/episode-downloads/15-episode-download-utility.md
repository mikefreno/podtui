# 15. Create Episode Download Utility [x]

meta:
  id: episode-downloads-15
  feature: episode-downloads
  priority: P2
  depends_on: [episode-downloads-14]
  tags: [downloads, utilities, file-io]

objective:
- Implement episode download functionality
- Download audio files from episode URLs
- Handle download errors and edge cases

deliverables:
- Download utility function
- File download handler
- Error handling for download failures

steps:
1. Create `src/utils/episode-downloader.ts`
2. Implement download function using Bun.file() or fetch
3. Add progress tracking during download
4. Handle download cancellation
5. Add error handling for network and file system errors

tests:
- Unit: Test download function with mock URLs
- Integration: Test with real audio file URLs
- Error handling: Test download failure scenarios

acceptance_criteria:
- Episodes can be downloaded successfully
- Download progress is tracked
- Errors are handled gracefully

validation:
- Download test episode from real podcast
- Verify file is saved correctly
- Check download progress tracking

notes:
- Use Bun's built-in file download capabilities
- Support resuming interrupted downloads
- Handle large files with streaming
- Add download speed tracking
- Consider download location in downloadPath setting
