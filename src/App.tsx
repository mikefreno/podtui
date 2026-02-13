import { createSignal, createMemo, ErrorBoundary, Accessor } from "solid-js";
import { useKeyboard, useSelectionHandler } from "@opentui/solid";
import { TabNavigation } from "./components/TabNavigation";
import { CodeValidation } from "@/components/CodeValidation";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";
import { useAudio } from "@/hooks/useAudio";
import { useMultimediaKeys } from "@/hooks/useMultimediaKeys";
import { FeedVisibility } from "@/types/feed";
import { Clipboard } from "@/utils/clipboard";
import { useToast } from "@/ui/toast";
import { useRenderer } from "@opentui/solid";
import type { AuthScreen } from "@/types/auth";
import type { Episode } from "@/types/episode";
import { DIRECTION, LayerGraph, TABS, LayerDepths } from "./utils/navigation";
import { useTheme, ThemeProvider } from "./context/ThemeContext";
import { KeybindProvider, useKeybinds } from "./context/KeybindContext";
import { useAudioNavStore, AudioSource } from "./stores/audio-nav";

const DEBUG = import.meta.env.DEBUG;

export interface PageProps {
  depth: Accessor<number>;
  focusedIndex?: Accessor<number> | number;
  focusedIndexValue?: number;
}

export function App() {
  const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
  const [activeDepth, setActiveDepth] = createSignal(0); // not fixed matrix size
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login");
  const [showAuthPanel, setShowAuthPanel] = createSignal(false);
  const [inputFocused, setInputFocused] = createSignal(false);
  const [layerDepth, setLayerDepth] = createSignal(0);
  const [focusedIndex, setFocusedIndex] = createSignal(0);

  const auth = useAuthStore();
  const feedStore = useFeedStore();
  const audio = useAudio();
  const toast = useToast();
  const renderer = useRenderer();
  const { theme } = useTheme();
  const keybind = useKeybinds();
  const audioNav = useAudioNavStore();

  useMultimediaKeys({
    playerFocused: () => activeTab() === TABS.PLAYER && layerDepth() > 0,
    inputFocused: () => inputFocused(),
    hasEpisode: () => !!audio.currentEpisode(),
  });

  const handlePlayEpisode = (episode: Episode) => {
    audio.play(episode);
    setActiveTab(TABS.PLAYER);
    setLayerDepth(1);
    audioNav.setSource(AudioSource.FEED);
  };

  useSelectionHandler((selection: any) => {
    if (!selection) return;
    const text = selection.getSelectedText?.();
    if (!text || text.trim().length === 0) return;

    Clipboard.copy(text)
      .then(() => {
        toast.show({ message: "Copied to Clipboard!", variant: "info" });
      })
      .catch(toast.error)
      .finally(() => {
        renderer.clearSelection();
      });
  });

  useKeyboard(
    (keyEvent) => {
      const isUp = keybind.match("up", keyEvent);
      const isDown = keybind.match("down", keyEvent);
      const isLeft = keybind.match("left", keyEvent);
      const isRight = keybind.match("right", keyEvent);
      const isCycle = keybind.match("cycle", keyEvent);
      const isDive = keybind.match("dive", keyEvent);
      const isOut = keybind.match("out", keyEvent);
      const isToggle = keybind.match("audio-toggle", keyEvent);
      const isNext = keybind.match("audio-next", keyEvent);
      const isPrev = keybind.match("audio-prev", keyEvent);
      const isSeekForward = keybind.match("audio-seek-forward", keyEvent);
      const isSeekBackward = keybind.match("audio-seek-backward", keyEvent);
      const isQuit = keybind.match("quit", keyEvent);

      if (DEBUG) {
        console.log("KeyEvent:", keyEvent);
        console.log("Keybinds loaded:", {
          up: keybind.keybinds.up,
          down: keybind.keybinds.down,
          left: keybind.keybinds.left,
          right: keybind.keybinds.right,
        });
      }

      if (isUp || isDown) {
        const currentDepth = activeDepth();
        const maxDepth = LayerDepths[activeTab()];

        console.log("Navigation:", { isUp, isDown, currentDepth, maxDepth });

        // Navigate within current depth layer
        if (currentDepth < maxDepth) {
          const newIndex = isUp ? focusedIndex() - 1 : focusedIndex() + 1;
          setFocusedIndex(Math.max(0, Math.min(newIndex, maxDepth)));
        }
      }

      // Horizontal movement - move within current layer
      if (isLeft || isRight) {
        const currentDepth = activeDepth();
        const maxDepth = LayerDepths[activeTab()];

        if (currentDepth < maxDepth) {
          const newIndex = isLeft ? focusedIndex() - 1 : focusedIndex() + 1;
          setFocusedIndex(Math.max(0, Math.min(newIndex, maxDepth)));
        }
      }

      // Cycle through current depth
      if (isCycle) {
        const currentDepth = activeDepth();
        const maxDepth = LayerDepths[activeTab()];

        if (currentDepth < maxDepth) {
          const newIndex = (focusedIndex() + 1) % (maxDepth + 1);
          setFocusedIndex(newIndex);
        }
      }

      // Increase depth
      if (isDive) {
        const currentDepth = activeDepth();
        const maxDepth = LayerDepths[activeTab()];

        if (currentDepth < maxDepth) {
          setActiveDepth(currentDepth + 1);
          setFocusedIndex(0);
        }
      }

      // Decrease depth
      if (isOut) {
        const currentDepth = activeDepth();

        if (currentDepth > 0) {
          setActiveDepth(currentDepth - 1);
          setFocusedIndex(0);
        }
      }

      if (isToggle) {
        audio.togglePlayback();
      }

      if (isNext) {
        audio.next();
      }

      if (isPrev) {
        audio.prev();
      }

      if (isSeekForward) {
        audio.seekRelative(15);
      }

      if (isSeekBackward) {
        audio.seekRelative(-15);
      }

      // Quit application
      if (isQuit) {
        process.exit(0);
      }
    },
    { release: false },
  );

  return (
    <KeybindProvider>
      <ThemeProvider mode="dark">
        <ErrorBoundary
          fallback={(err) => (
            <box border padding={2} borderColor={theme.error}>
              <text fg={theme.error}>
                Error: {err?.message ?? String(err)}
                {"\n"}
                Press a number key (1-6) to switch tabs.
              </text>
            </box>
          )}
        >
          {DEBUG && (
            <box flexDirection="row" width="100%" height={1}>
              <text fg={theme.primary}>█</text>
              <text fg={theme.secondary}>█</text>
              <text fg={theme.accent}>█</text>
              <text fg={theme.error}>█</text>
              <text fg={theme.warning}>█</text>
              <text fg={theme.success}>█</text>
              <text fg={theme.info}>█</text>
              <text fg={theme.text}>█</text>
              <text fg={theme.textMuted}>█</text>
              <text fg={theme.surface}>█</text>
              <text fg={theme.background}>█</text>
              <text fg={theme.border}>█</text>
              <text fg={theme.borderActive}>█</text>
              <text fg={theme.diffAdded}>█</text>
              <text fg={theme.diffRemoved}>█</text>
              <text fg={theme.diffContext}>█</text>
              <text fg={theme.markdownText}>█</text>
              <text fg={theme.markdownHeading}>█</text>
              <text fg={theme.markdownLink}>█</text>
              <text fg={theme.markdownCode}>█</text>
              <text fg={theme.syntaxKeyword}>█</text>
              <text fg={theme.syntaxString}>█</text>
              <text fg={theme.syntaxNumber}>█</text>
              <text fg={theme.syntaxFunction}>█</text>
            </box>
          )}
          <box flexDirection="row" width="100%" height={1} />
          <box
            flexDirection="row"
            width="100%"
            height="100%"
            backgroundColor={theme.surface}
          >
            <TabNavigation activeTab={activeTab()} onTabSelect={setActiveTab} />
            {LayerGraph[activeTab()]({
              depth: activeDepth,
              focusedIndex: focusedIndex(),
            })}
            {/** TODO: Contextual controls based on tab/depth**/}
          </box>
        </ErrorBoundary>
      </ThemeProvider>
    </KeybindProvider>
  );
}
