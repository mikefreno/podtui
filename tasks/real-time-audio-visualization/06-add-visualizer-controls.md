# 06. Add visualizer controls and settings

meta:
  id: real-time-audio-visualization-06
  feature: real-time-audio-visualization
  priority: P2
  depends_on: [real-time-audio-visualization-05]
  tags: [ui, controls, settings]

objective:
- Add user controls for visualizer settings
- Create settings panel for customization
- Allow users to adjust visualizer parameters

deliverables:
- src/components/VisualizerSettings.tsx - Settings component
- Updated src/components/Player.tsx - Settings panel integration
- src/types/settings.ts - Visualizer settings type definition
- src/stores/settings.ts - Settings state management

steps:
- Define visualizer settings types:
  - Number of bars (resolution)
  - Sensitivity (autosens toggle + manual value)
  - Noise reduction level
  - Frequency cutoffs (low/high)
  - Bar width and spacing
  - Color scheme options
- Create VisualizerSettings component:
  - Display current settings
  - Allow adjusting each parameter
  - Show real-time feedback
  - Save settings to app store
- Integrate with Player component:
  - Add settings button
  - Show settings panel when toggled
  - Apply settings to RealtimeWaveform component
- Update settings state management:
  - Load saved settings from app store
  - Save settings on change
  - Provide default values
- Create UI for settings:
  - Keyboard shortcuts for quick adjustment
  - Visual feedback for changes
  - Help text for each setting
- Add settings persistence
- Create tests for settings component

tests:
- Unit: Test settings type definitions
- Unit: Test settings state management
- Unit: Test VisualizerSettings component
- Integration: Test settings apply to visualization
- Integration: Test settings persistence
- Manual: Test all settings controls

acceptance_criteria:
- VisualizerSettings component renders correctly
- All settings can be adjusted
- Changes apply in real-time
- Settings persist between sessions
- Keyboard shortcuts work
- Component handles invalid settings gracefully

validation:
- Run: `bun test` for unit tests
- Run: `bun test` for integration tests
- Manual: Test all settings
- Manual: Test keyboard shortcuts
- Manual: Test settings persistence

notes:
- Settings should have sensible defaults
- Some settings may require visualizer re-initialization
- Consider limiting certain settings to avoid performance issues
- Add tooltips or help text for complex settings
- Settings should be optional - users can start without them
- Keep UI simple and intuitive
