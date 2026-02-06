# 02. Integrate cavacore library for audio analysis

meta:
  id: real-time-audio-visualization-02
  feature: real-time-audio-visualization
  priority: P0
  depends_on: [real-time-audio-visualization-01]
  tags: [integration, audio-processing]

objective:
- Create a TypeScript binding for the cavacore C library
- Provide async API for real-time audio frequency analysis

deliverables:
- src/utils/cavacore.ts - TypeScript bindings for cavacore API
- src/utils/audio-visualizer.ts - High-level audio visualizer class
- Updated package.json with FFTW dependency

steps:
- Review cavacore.h API and understand the interface:
  - cava_init() - Initialize with parameters
  - cava_execute() - Process samples and return frequencies
  - cava_destroy() - Clean up
- Create cavacore.ts wrapper with TypeScript types:
  - Define C-style structs as TypeScript interfaces
  - Create bind() function to load shared library
  - Implement async wrappers for init, execute, destroy
- Create audio-visualizer.ts class:
  - Handle initialization with configurable parameters (bars, sensitivity, noise reduction)
  - Provide execute() method that accepts audio samples and returns frequency data
  - Manage cleanup and error handling
- Update package.json:
  - Add @types/fftw3 dependency (if available) or document manual installation
  - Add build instructions for linking FFTW library
- Test basic initialization and execution with dummy data

tests:
- Unit: Test cavacore initialization with valid parameters
- Unit: Test cavacore execution with sample audio data
- Unit: Test cleanup and memory management
- Integration: Verify no memory leaks after multiple init/destroy cycles
- Integration: Test with actual audio data from ffmpeg

acceptance_criteria:
- cavacore.ts compiles without TypeScript errors
- audio-visualizer.ts can be imported and initialized
- execute() method returns frequency data array
- Proper error handling for missing FFTW library
- No memory leaks in long-running tests

validation:
- Run: `bun run build` to verify TypeScript compilation
- Run: `bun test` for unit tests
- Manual: Test with sample audio file and verify output

notes:
- FFTW library needs to be installed separately on the system
- On macOS: brew install fftw
- On Linux: apt install libfftw3-dev
- The C code will need to be compiled into a shared library (.so/.dylib/.dll)
- For Bun, we can use `Bun.native()` or `Bun.ffi` to call C functions
