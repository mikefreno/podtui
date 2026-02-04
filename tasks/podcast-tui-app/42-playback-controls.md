# 41. Create Player UI Layout

meta:
  id: podcast-tui-app-41
  feature: podcast-tui-app
  priority: P0
  depends_on: [40]
  tags: [player, layout, solidjs, opentui]

objective:
- Create player UI layout component
- Display episode information
- Position player controls and waveform
- Handle player state

deliverables:
- `src/components/Player.tsx` with player layout
- `src/components/PlayerHeader.tsx` with episode info
- `src/components/PlayerControls.tsx` with controls area

steps:
- Create `src/components/Player.tsx`:
  - Player container with borders
  - Episode information header
  - Waveform visualization area
  - Playback controls area
  - Progress bar area
- Create `src/components/PlayerHeader.tsx`:
  - Episode title
  - Podcast name
  - Episode duration
  - Close player button
- Create `src/components/PlayerControls.tsx`:
  - Play/Pause button
  - Previous/Next episode buttons
  - Volume control
  - Speed control
  - Keyboard shortcuts display

tests:
- Unit: Test Player layout renders correctly
- Unit: Test PlayerHeader displays correctly
- Unit: Test PlayerControls layout

acceptance_criteria:
- Player UI displays episode information
- Controls positioned correctly
- Player fits within terminal bounds
- Layout is responsive

validation:
- Run application and navigate to "Player"
- Select an episode to play
- Verify player UI displays
- Check layout and positioning

notes:
- Use Flexbox for player layout
- Player should be at bottom or overlay
- Use `<scrollbox>` for waveform area
- Add loading state when no episode
- Use SolidJS signals for player state
