# 45. Implement Audio Integration (System/External Player)

meta:
  id: podcast-tui-app-45
  feature: podcast-tui-app
  priority: P0
  depends_on: [44]
  tags: [audio, integration, player, solidjs]

objective:
- Implement audio playback integration
- Support system audio player
- Support external player
- Handle audio events

deliverables:
- `src/utils/audio-player.ts` with audio integration
- `src/components/AudioSettings.tsx` with audio player settings
- `src/hooks/useAudio.ts` with audio hook

steps:
- Create `src/utils/audio-player.ts`:
  - `playWithSystemPlayer(audioUrl: string): void`
  - `playWithExternalPlayer(audioUrl: string): void`
  - `getSupportedPlayers(): string[]`
  - Detect available players
- Create `src/components/AudioSettings.tsx`:
  - Player selection dropdown
  - System player options
  - External player options
  - Default player selection
- Create `src/hooks/useAudio.ts`:
  - Manage audio state
  - Handle player selection
  - Handle audio events
  - Update progress

tests:
- Unit: Test audio player detection
- Unit: Test player selection
- Integration: Test audio playback

acceptance_criteria:
- Audio plays correctly
- Multiple player options available
- Player selection persists
- Audio events handled

validation:
- Run application and test audio
- Select different player options
- Play episode and verify audio
- Test progress tracking with audio

notes:
- System player: macOS Terminal, iTerm2, etc.
- External player: VLC, QuickTime, etc.
- Use `open` command for macOS
- Use `xdg-open` for Linux
- Use `start` for Windows
- Handle audio errors gracefully
- Add player selection in settings
- Default to system player
- Store player preference
