# 05. Maintain Plain Text Fallback Handling

meta:
  id: rss-content-parsing-05
  feature: rss-content-parsing
  priority: P2
  depends_on: [rss-content-parsing-03]
  tags: [rss, parsing, fallback]

objective:
- Ensure plain text RSS feeds continue to work correctly
- Maintain backward compatibility with existing functionality
- Handle mixed content scenarios

deliverables:
- Updated parseRSSFeed() for HTML support
- Plain text handling path remains unchanged
- Error handling for parsing failures

steps:
1. Update `parseRSSFeed()` to use content type detection
2. Route to HTML parser or plain text path based on type
3. Add error handling for parsing failures
4. Test with both HTML and plain text feeds
5. Verify backward compatibility

tests:
- Integration: Test with plain text RSS feeds
- Integration: Test with HTML RSS feeds
- Regression: Verify existing functionality still works

acceptance_criteria:
- Plain text feeds parse without errors
- HTML feeds parse correctly with sanitization
- No regression in existing functionality

validation:
- Test with various podcast RSS feeds
- Verify descriptions display correctly
- Check for any parsing errors

notes:
- Plain text path uses existing `decodeEntities()` logic
- Keep existing parseRSSFeed() structure for plain text
- Add logging for parsing strategy selection
