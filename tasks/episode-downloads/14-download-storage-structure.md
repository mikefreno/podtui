# 14. Define Download Storage Structure [x]

meta:
  id: episode-downloads-14
  feature: episode-downloads
  priority: P2
  depends_on: []
  tags: [storage, types, data-model]

objective:
- Define data structures for downloaded episodes
- Create download state tracking
- Design download history and metadata storage

deliverables:
- DownloadedEpisode type definition
- Download state interface
- Storage schema for download metadata

steps:
1. Add DownloadedEpisode type to types/episode.ts
2. Define download state structure (status, progress, timestamp)
3. Create download metadata interface
4. Add download-related fields to Feed type
5. Design database-like storage structure

tests:
- Unit: Test type definitions
- Integration: Test storage schema
- Validation: Verify structure supports all download scenarios

acceptance_criteria:
- DownloadedEpisode type properly defines download metadata
- Download state interface tracks all necessary information
- Storage schema supports history and progress tracking

validation:
- Review type definitions for completeness
- Verify storage structure can hold all download data
- Test with mock download scenarios

notes:
- Add fields: status (downloading, completed, failed), progress (0-100), filePath, downloadedAt
- Include download speed and estimated time remaining
- Store download history with timestamps
- Consider adding resume capability
