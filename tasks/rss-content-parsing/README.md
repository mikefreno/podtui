# HTML vs Plain Text RSS Parsing

Objective: Detect and handle both HTML and plain text content in RSS feeds

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks
- [ ] 03 — Add content type detection utility → `03-rss-content-detection.md`
- [ ] 04 — Implement HTML content parsing → `04-html-content-extraction.md`
- [ ] 05 — Maintain plain text fallback handling → `05-plain-text-content-handling.md`

Dependencies
- 03 -> 04
- 03 -> 05

Exit criteria
- RSS feeds with HTML content are properly parsed and sanitized
- Plain text feeds continue to work as before
