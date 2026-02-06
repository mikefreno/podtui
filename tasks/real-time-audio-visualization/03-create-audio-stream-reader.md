# 03. Create audio stream reader for real-time data

meta:
  id: real-time-audio-visualization-03
  feature: real-time-audio-visualization
  priority: P1
  depends_on: [real-time-audio-visualization-02]
  tags: [audio-stream, real-time]

objective:
- Create a mechanism to read audio stream from mpv backend
- Convert audio data to format suitable for cavacore processing
- Implement efficient buffer management

deliverables:
- src/utils/audio-stream-reader.ts - Audio stream reader class
- src/utils/audio-stream-reader.test.ts - Unit tests

steps:
- Design audio stream reader interface:
  - Constructor accepts audio URL and backend (mpv)
  - Start() method initiates audio playback and stream capture
  - readSamples() method returns next batch of audio samples
  - stop() method terminates stream capture
- Implement stream reading for mpv backend:
  - Use mpv IPC to query audio device parameters (sample rate, channels)
  - Use ffmpeg or similar to pipe audio output to stdin
  - Read PCM samples from the stream
- Convert audio samples to appropriate format:
  - Handle different bit depths (16-bit, 32-bit)
  - Handle different sample rates (44100, 48000, etc.)
  - Interleave stereo channels if needed
- Implement buffer management:
  - Circular buffer for efficient sample storage
  - Non-blocking read with timeout
  - Sample rate conversion if needed
- Handle errors:
  - Invalid audio URL
  - Backend connection failure
  - Sample format mismatch
- Create unit tests:
  - Mock mpv backend
  - Test sample reading
  - Test buffer management
  - Test error conditions

tests:
- Unit: Test sample rate detection
- Unit: Test channel detection
- Unit: Test sample reading with valid data
- Unit: Test buffer overflow handling
- Unit: Test error handling for invalid audio
- Integration: Test with actual audio file and mpv
- Integration: Test with ffplay backend

acceptance_criteria:
- Audio stream reader successfully reads audio data from mpv
- Samples are converted to 16-bit PCM format
- Buffer management prevents overflow
- Error handling works for invalid audio
- No memory leaks in long-running tests

validation:
- Run: `bun test` for unit tests
- Manual: Play audio and verify stream reader captures data
- Manual: Test with different audio formats (mp3, wav, m4a)

notes:
- mpv can output audio via pipe to stdin using --audio-file-pipe
- Alternative: Use ffmpeg to re-encode audio to standard format
- Sample rate conversion may be needed for cavacore compatibility
- For simplicity, start with 16-bit PCM, single channel (mono)
