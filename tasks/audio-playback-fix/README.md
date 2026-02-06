# Audio Playback Fix

Objective: Fix volume and speed controls and add multimedia key support with platform media stream integration

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks
- [ ] 01 — Fix volume and speed controls in audio backends → `01-fix-volume-speed-controls.md`
- [ ] 02 — Add multimedia key detection and handling → `02-add-multimedia-key-detection.md`
- [ ] 03 — Implement platform-specific media stream integration → `03-implement-platform-media-integration.md`
- [ ] 04 — Add media key listeners to audio hook → `04-add-media-key-listeners.md`
- [ ] 05 — Test multimedia controls across platforms → `05-test-multimedia-controls.md`

Dependencies
- 01 depends on 02
- 02 depends on 03
- 03 depends on 04
- 04 depends on 05

Exit criteria
- Volume controls change playback volume in real-time
- Speed controls change playback speed in real-time
- Multimedia keys (Space, Arrow keys, Volume keys, Media keys) control playback
- Audio player appears in system media controls
- System multimedia keys trigger appropriate playback actions
- All controls work across mpv, ffplay, and afplay backends
