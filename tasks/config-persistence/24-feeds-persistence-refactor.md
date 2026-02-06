# 24. Refactor Feeds Persistence to JSON File

meta:
  id: config-persistence-24
  feature: config-persistence
  priority: P1
  depends_on: [config-persistence-23]
  tags: [persistence, feeds, file-io]

objective:
- Move feeds persistence from localStorage to JSON file
- Load feeds from XDG_CONFIG_HOME directory
- Save feeds to JSON file
- Maintain backward compatibility

deliverables:
- Feeds JSON file I/O functions
- Updated feed store persistence
- Migration from localStorage

steps:
1. Create `src/utils/feeds-persistence.ts`
2. Implement loadFeedsFromFile() function
3. Implement saveFeedsToFile() function
4. Update feed store to use file-based persistence
5. Add migration from localStorage to file

tests:
- Unit: Test file I/O functions
- Integration: Test feed persistence with file
- Migration: Test migration from localStorage

acceptance_criteria:
- Feeds are loaded from JSON file
- Feeds are saved to JSON file
- Backward compatibility maintained

validation:
- Start app with no config file
- Subscribe to feeds
- Verify feeds saved to file
- Restart app and verify feeds loaded
- Test migration from localStorage

notes:
- File path: XDG_CONFIG_HOME/podcast-tui-app/feeds.json
- Use JSON.stringify/parse for serialization
- Handle file not found (empty initial load)
- Handle file write errors
- Add timestamp to file for versioning
- Maintain Feed type structure
