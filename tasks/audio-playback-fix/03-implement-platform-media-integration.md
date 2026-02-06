# 03. Implement platform-specific media stream integration [x]

meta:
  id: audio-playback-fix-03
  feature: audio-playback-fix
  priority: P2
  depends_on: []
  tags: [implementation, platform-integration, media-apis]

objective:
- Register audio player with platform-specific media frameworks
- Enable OS media controls (notification center, lock screen, multimedia keys)
- Support macOS AVFoundation, Windows Media Foundation, and Linux PulseAudio/GStreamer

deliverables:
- Platform-specific media registration module in `src/utils/media-registry.ts`
- Integration with audio hook to register/unregister media streams
- Platform detection and conditional registration logic
- Documentation of supported platforms and media APIs

steps:
- Step 1: Research platform-specific media API integration options
- Step 2: Create `MediaRegistry` class with platform detection
- Step 3: Implement macOS AVFoundation integration (AVPlayer + AVAudioSession)
- Step 4: Implement Windows Media Foundation integration (MediaSession + PlaybackInfo)
- Step 5: Implement Linux PulseAudio/GStreamer integration (Mpris or libpulse)
- Step 6: Integrate with audio hook to register media stream on play
- Step 7: Unregister media stream on stop or dispose
- Step 8: Handle platform-specific limitations and fallbacks
- Step 9: Test media registration across platforms

tests:
- Unit:
  - Test platform detection returns correct platform name
  - Test MediaRegistry.register() calls platform-specific APIs
  - Test MediaRegistry.unregister() cleans up platform resources
- Integration:
  - Test audio player appears in macOS notification center
  - Test audio player appears in Windows media controls
  - Test audio player appears in Linux media player notifications
  - Test media controls update with playback position
  - Test multimedia keys control playback through media APIs

acceptance_criteria:
- Audio player appears in platform media controls (notification center, lock screen)
- Media controls update with current track info and playback position
- Multimedia keys work through media APIs (not just terminal)
- Media registration works on macOS, Windows, and Linux
- Media unregistration properly cleans up resources
- No memory leaks from media stream registration

validation:
- On macOS: Check notification center for audio player notification
- On Windows: Check media controls in taskbar/notification area
- On Linux: Check media player notifications in desktop environment
- Test multimedia keys work with system media player (not just terminal)
- Monitor memory usage for leaks

notes:
- Platform-specific media APIs are complex and may have limitations
- macOS AVFoundation: Use AVPlayer with AVAudioSession for media registration
- Windows Media Foundation: Use MediaSession API and PlaybackInfo for media controls
- Linux: Use Mpris (Media Player Remote Interface Specification) or libpulse
- May need additional platform-specific dependencies or native code
- Fallback to terminal multimedia key handling if platform APIs unavailable
- Reference: Platform-specific media API documentation and examples
