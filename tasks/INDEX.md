# PodTUI Task Index

This directory contains all task files for the PodTUI project feature implementation.

## Task Structure

Each feature has its own directory with:
- `README.md` - Feature overview and task list
- `{seq}-{task-description}.md` - Individual task files

## Feature Overview

### 1. Text Selection Copy to Clipboard
**Feature:** Text selection copy to clipboard
**Tasks:** 2 tasks
**Directory:** `tasks/text-selection-copy/`

### 2. HTML vs Plain Text RSS Parsing
**Feature:** Detect and handle both HTML and plain text content in RSS feeds
**Tasks:** 3 tasks
**Directory:** `tasks/rss-content-parsing/`

### 3. Merged Waveform Progress Bar
**Feature:** Create a real-time waveform visualization that expands from a progress bar during playback
**Tasks:** 4 tasks
**Directory:** `tasks/merged-waveform/`

### 4. Episode List Infinite Scroll
**Feature:** Implement scroll-to-bottom loading for episode lists with MAX_EPISODES_REFRESH limit
**Tasks:** 4 tasks
**Directory:** `tasks/episode-infinite-scroll/`

### 5. Episode Downloads
**Feature:** Add per-episode download and per-feed auto-download settings
**Tasks:** 6 tasks
**Directory:** `tasks/episode-downloads/`

### 6. Discover Categories Shortcuts Fix
**Feature:** Fix broken discover category filter functionality
**Tasks:** 3 tasks
**Directory:** `tasks/discover-categories-fix/`

### 7. Config Persistence to XDG_CONFIG_HOME
**Feature:** Move feeds and themes persistence from localStorage to XDG_CONFIG_HOME directory
**Tasks:** 5 tasks
**Directory:** `tasks/config-persistence/`

## Task Summary

**Total Features:** 7
**Total Tasks:** 27
**Critical Path:** Feature 7 (Config Persistence) - 5 tasks

## Task Dependencies

### Feature 1: Text Selection Copy to Clipboard
- 01 → 02

### Feature 2: HTML vs Plain Text RSS Parsing
- 03 → 04
- 03 → 05

### Feature 3: Merged Waveform Progress Bar
- 06 → 07
- 07 → 08
- 08 → 09

### Feature 4: Episode List Infinite Scroll
- 10 → 11
- 11 → 12
- 12 → 13

### Feature 5: Episode Downloads
- 14 → 15
- 15 → 16
- 16 → 17
- 17 → 18
- 18 → 19

### Feature 6: Discover Categories Shortcuts Fix
- 20 → 21
- 21 → 22

### Feature 7: Config Persistence to XDG_CONFIG_HOME
- 23 → 24
- 23 → 25
- 24 → 26
- 25 → 26
- 26 → 27

## Priority Overview

**P1 (Critical):**
- 23: Implement XDG_CONFIG_HOME directory setup
- 24: Refactor feeds persistence to JSON file
- 25: Refactor theme persistence to JSON file
- 26: Add config file validation and migration

**P2 (High):**
- All other tasks (01-22, 27)

**P3 (Medium):**
- 09: Optimize waveform rendering performance
- 13: Add loading indicator for pagination
- 19: Create download queue management

## Next Steps

1. Review all task files for accuracy
2. Confirm task dependencies
3. Start with P1 tasks (Feature 7)
4. Follow dependency order within each feature
5. Mark tasks complete as they're finished
