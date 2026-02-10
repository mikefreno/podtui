/**
 * RealtimeWaveform — live audio frequency visualization using cavacore.
 *
 * Spawns an independent ffmpeg
 * process to decode the audio stream, feeds PCM samples through cavacore
 * for FFT analysis, and renders frequency bars as colored terminal
 * characters at ~30fps.
 */

import { createSignal, createEffect, onCleanup, on, untrack } from "solid-js";
import {
  loadCavaCore,
  type CavaCore,
  type CavaCoreConfig,
} from "@/utils/cavacore";
import { AudioStreamReader } from "@/utils/audio-stream-reader";
import { useAudio } from "@/hooks/useAudio";
import { useTheme } from "@/context/ThemeContext";

// ── Types ────────────────────────────────────────────────────────────

export type RealtimeWaveformProps = {
  visualizerConfig?: Partial<CavaCoreConfig>;
};

/** Unicode lower block elements: space (silence) through full block (max) */
const BARS = [
  " ",
  "\u2581",
  "\u2582",
  "\u2583",
  "\u2584",
  "\u2585",
  "\u2586",
  "\u2587",
  "\u2588",
];

/** Target frame interval in ms (~30 fps) */
const FRAME_INTERVAL = 33;

/** Number of PCM samples to read per frame (512 is a good FFT window) */
const SAMPLES_PER_FRAME = 512;

// ── Component ────────────────────────────────────────────────────────

export function RealtimeWaveform(props: RealtimeWaveformProps) {
  const { theme } = useTheme();
  const audio = useAudio();

  // Frequency bar values (0.0–1.0 per bar)
  const [barData, setBarData] = createSignal<number[]>([]);

  // Track whether cavacore is available
  const [available, setAvailable] = createSignal(false);

  let cava: CavaCore | null = null;
  let reader: AudioStreamReader | null = null;
  let frameTimer: ReturnType<typeof setInterval> | null = null;
  let sampleBuffer: Float64Array | null = null;

  // ── Lifecycle: init cavacore once ──────────────────────────────────

  const initCava = () => {
    if (cava) return true;

    cava = loadCavaCore();
    if (!cava) {
      setAvailable(false);
      return false;
    }

    setAvailable(true);
    return true;
  };

  // ── Start/stop the visualization pipeline ──────────────────────────

  const startVisualization = (url: string, position: number, speed: number) => {
    stopVisualization();

    if (!url || !initCava() || !cava) return;

    // Initialize cavacore with current resolution + any overrides
    const config: CavaCoreConfig = {
      bars: 32,
      sampleRate: 44100,
      channels: 1,
      ...props.visualizerConfig,
    };
    cava.init(config);

    // Pre-allocate sample read buffer
    sampleBuffer = new Float64Array(SAMPLES_PER_FRAME);

    // Start ffmpeg decode stream (reuse reader if same URL, else create new)
    if (!reader || reader.url !== url) {
      if (reader) reader.stop();
      reader = new AudioStreamReader({ url });
    }
    reader.start(position, speed);

    // Start render loop
    frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
  };

  const stopVisualization = () => {
    if (frameTimer) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
    if (reader) {
      reader.stop();
      // Don't null reader — we reuse it across start/stop cycles
    }
    if (cava?.isReady) {
      cava.destroy();
    }
    sampleBuffer = null;
  };

  // ── Render loop (called at ~30fps) ─────────────────────────────────

  const renderFrame = () => {
    if (!cava?.isReady || !reader?.running || !sampleBuffer) return;

    // Read available PCM samples from the stream
    const count = reader.read(sampleBuffer);
    if (count === 0) return;

    // Feed samples to cavacore → get frequency bars
    const input =
      count < sampleBuffer.length
        ? sampleBuffer.subarray(0, count)
        : sampleBuffer;
    const output = cava.execute(input);

    // Copy bar values to a new array for the signal
    setBarData(Array.from(output));
  };

  createEffect(
    on(
      [
        audio.isPlaying,
        () => audio.currentEpisode()?.audioUrl ?? "", // may need to fire an error here
        audio.speed,
        () => 32,
      ],
      ([playing, url, speed]) => {
        if (playing && url) {
          const pos = untrack(audio.position);
          startVisualization(url, pos, speed);
        } else {
          stopVisualization();
        }
      },
    ),
  );

  // ── Seek detection: lightweight effect for position jumps ──────────
  //
  // Watches position and restarts the reader (not the whole pipeline)
  // only on significant jumps (>2s), which indicate a user seek.
  // This is intentionally a separate effect — it should NOT trigger a
  // full pipeline restart, just restart the ffmpeg stream at the new pos.

  let lastSyncPosition = 0;
  createEffect(
    on(audio.position, (pos) => {
      if (!audio.isPlaying || !reader?.running) {
        lastSyncPosition = pos;
        return;
      }

      const delta = Math.abs(pos - lastSyncPosition);
      lastSyncPosition = pos;

      if (delta > 2) {
        reader.restart(pos, audio.speed() ?? 1);
      }
    }),
  );

  // Cleanup on unmount
  onCleanup(() => {
    stopVisualization();
    if (reader) {
      reader.stop();
      reader = null;
    }
    // Don't null cava itself — it can be reused. But do destroy its plan.
    if (cava?.isReady) {
      cava.destroy();
    }
  });

  // ── Rendering ──────────────────────────────────────────────────────

  const playedRatio = () =>
    audio.duration() <= 0
      ? 0
      : Math.min(1, audio.position() / audio.duration());

  const renderLine = () => {
    const bars = barData();
    const numBars = 32;

    // If no data yet, show empty placeholder
    if (bars.length === 0) {
      const placeholder = ".".repeat(numBars);
      return (
        <box flexDirection="row" gap={0}>
          <text fg="#3b4252">{placeholder}</text>
        </box>
      );
    }

    const played = Math.floor(numBars * playedRatio());
    const playedColor = audio.isPlaying() ? "#6fa8ff" : "#7d8590";
    const futureColor = "#3b4252";

    const playedChars = bars
      .slice(0, played)
      .map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
      .join("");

    const futureChars = bars
      .slice(played)
      .map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
      .join("");

    return (
      <box flexDirection="row" gap={0}>
        <text fg={playedColor}>{playedChars || " "}</text>
        <text fg={futureColor}>{futureChars || " "}</text>
      </box>
    );
  };

  const handleClick = (event: { x: number }) => {
    const numBars = 32;
    const ratio = event.x / numBars;
    const next = Math.max(
      0,
      Math.min(audio.duration(), Math.round(audio.duration() * ratio)),
    );
    audio.seek(next);
  };

  return (
    <box border borderColor={theme.border} padding={1} onMouseDown={handleClick}>
      {renderLine()}
    </box>
  );
}