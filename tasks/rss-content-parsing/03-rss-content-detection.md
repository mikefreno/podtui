# 03. Add RSS Content Type Detection

meta:
  id: rss-content-parsing-03
  feature: rss-content-parsing
  priority: P2
  depends_on: []
  tags: [rss, parsing, utilities]

objective:
- Create utility to detect if RSS feed content is HTML or plain text
- Analyze content type in description and other text fields
- Return appropriate parsing strategy

deliverables:
- Content type detection function
- Type classification utility
- Integration points for different parsers

steps:
1. Create `src/utils/rss-content-detector.ts`
2. Implement content type detection based on HTML tags
3. Add detection for common HTML entities and tags
4. Return type enum (HTML, PLAIN_TEXT, UNKNOWN)
5. Add unit tests for detection accuracy

tests:
- Unit: Test HTML detection with various HTML snippets
- Unit: Test plain text detection with text-only content
- Unit: Test edge cases (mixed content, malformed HTML)

acceptance_criteria:
- Function correctly identifies HTML vs plain text content
- Handles common HTML patterns and entities
- Returns UNKNOWN for unclassifiable content

validation:
- Test with HTML description from real RSS feeds
- Test with plain text descriptions
- Verify UNKNOWN cases are handled gracefully

notes:
- Look for common HTML tags: <div>, <p>, <br>, <a>, <b>, <i>
- Check for HTML entities: &lt;, &gt;, &amp;, &quot;, &apos;
- Consider content length threshold for HTML detection
