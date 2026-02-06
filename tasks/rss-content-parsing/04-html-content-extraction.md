# 04. Implement HTML Content Extraction

meta:
  id: rss-content-parsing-04
  feature: rss-content-parsing
  priority: P2
  depends_on: [rss-content-parsing-03]
  tags: [rss, parsing, html]

objective:
- Parse HTML content from RSS feed descriptions
- Extract and sanitize text content
- Convert HTML to plain text for display

deliverables:
- HTML to text conversion utility
- Sanitization function for XSS prevention
- Updated RSS parser integration

steps:
1. Create `src/utils/html-to-text.ts`
2. Implement HTML-to-text conversion algorithm
3. Add XSS sanitization for extracted content
4. Handle common HTML elements (paragraphs, lists, links)
5. Update `parseRSSFeed()` to use new HTML parser

tests:
- Unit: Test HTML to text conversion accuracy
- Integration: Test with HTML-rich RSS feeds
- Security: Test XSS sanitization with malicious HTML

acceptance_criteria:
- HTML content is converted to readable plain text
- No HTML tags remain in output
- Sanitization prevents XSS attacks
- Links are properly converted to text format

validation:
- Test with podcast descriptions containing HTML
- Verify text is readable and properly formatted
- Check for any HTML tag remnants

notes:
- Use existing `decodeEntities()` function from rss-parser.ts
- Preserve line breaks and paragraph structure
- Convert URLs to text format (e.g., "Visit example.com")
- Consider using a lightweight HTML parser like `html-escaper` or `cheerio`
