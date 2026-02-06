# 01. Copy cavacore library files to project

meta:
  id: real-time-audio-visualization-01
  feature: real-time-audio-visualization
  priority: P0
  depends_on: []
  tags: [setup, build]

objective:
- Copy necessary cava library files from cava/ directory to src/utils/ for integration

deliverables:
- src/utils/cavacore.h - Header file with cavacore API
- src/utils/cavacore.c - Implementation of cavacore library
- src/utils/audio-stream.h - Audio stream reader header
- src/utils/audio-stream.c - Audio stream reader implementation
- src/utils/audio-input.h - Common audio input types
- src/utils/audio-input.c - Audio input buffer management

steps:
- Identify necessary files from cava/ directory:
  - cavacore.h (API definition)
  - cavacore.c (FFT processing implementation)
  - input/common.h (common audio data structures)
  - input/common.c (input buffer handling)
  - input/fifo.h (FIFO input support - optional, for testing)
  - input/fifo.c (FIFO input implementation - optional)
- Copy cavacore.h to src/utils/
- Copy cavacore.c to src/utils/
- Copy input/common.h to src/utils/
- Copy input/common.c to src/utils/
- Copy input/fifo.h to src/utils/ (optional)
- Copy input/fifo.c to src/utils/ (optional)
- Update file headers to indicate origin and licensing
- Note: Files from cava/ directory will be removed after integration

tests:
- Unit: Verify all files compile successfully
- Integration: Ensure no import errors in TypeScript/JavaScript files
- Manual: Check that files are accessible from src/utils/

acceptance_criteria:
- All required cava files are copied to src/utils/
- File headers include proper copyright and license information
- No compilation errors from missing dependencies
- Files are properly formatted for TypeScript/JavaScript integration

validation:
- Run: `bun run build` to verify compilation
- Check: `ls src/utils/*.c src/utils/*.h` to confirm file presence

notes:
- Only need cavacore.c, cavacore.h, and common.c/common.h for basic functionality
- input/fifo.c is optional - can be added later if needed
- FFTW library will need to be installed and linked separately
- The files will be integrated into the audio-waveform utility
