import { createMemo, ErrorBoundary, Accessor } from "solid-js";
import { useKeyboard, useSelectionHandler } from "@opentui/solid";
import { TabNavigation } from "./components/TabNavigation";
import { CodeValidation } from "@/components/CodeValidation";
import { LoadingIndicator } from "@/components/LoadingIndicator";
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
import { NavigationProvider, useNavigation } from "./context/NavigationContext";
import { useAudioNavStore, AudioSource } from "./stores/audio-nav";

const DEBUG = import.meta.env.DEBUG;

export function App() {
  const nav = useNavigation();
  const auth = useAuthStore();
  const feedStore = useFeedStore();
  const audio = useAudio();
  const toast = useToast();
  const renderer = useRenderer();
  const themeContext = useTheme();
  const theme = themeContext.theme;

  // Create a reactive expression for background color
  const backgroundColor = () => {
    return themeContext.selected === "system"
      ? "transparent"
      : themeContext.theme.surface;
  };
  const keybind = useKeybinds();
  const audioNav = useAudioNavStore();

  useMultimediaKeys({
    playerFocused: () => nav.activeTab === TABS.PLAYER && nav.activeDepth > 0,
    inputFocused: () => nav.inputFocused,
    hasEpisode: () => !!audio.currentEpisode(),
  });

  const handlePlayEpisode = (episode: Episode) => {
    audio.play(episode);
    nav.setActiveTab(TABS.PLAYER);
    nav.setActiveDepth(1);
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
      const isCycle = keybind.match("cycle", keyEvent);
      const isUp = keybind.match("up", keyEvent);
      const isDown = keybind.match("down", keyEvent);
      const isLeft = keybind.match("left", keyEvent);
      const isRight = keybind.match("right", keyEvent);
      const isDive = keybind.match("dive", keyEvent);
      const isOut = keybind.match("out", keyEvent);
      const isToggle = keybind.match("audio-toggle", keyEvent);
      const isNext = keybind.match("audio-next", keyEvent);
      const isPrev = keybind.match("audio-prev", keyEvent);
      const isSeekForward = keybind.match("audio-seek-forward", keyEvent);
      const isSeekBackward = keybind.match("audio-seek-backward", keyEvent);
      const isQuit = keybind.match("quit", keyEvent);
      const isInverting = keybind.isInverting(keyEvent);

      // only handling top navigation here, cycle through tabs, just to high priority(player) all else to be handled in each tab
      if (nav.activeDepth == 0) {
        if (
          (isCycle && !isInverting) ||
          (isDown && !isInverting) ||
          (isUp && isInverting)
        ) {
          nav.nextTab();
          return;
        }
        if (
          (isCycle && isInverting) ||
          (isDown && isInverting) ||
          (isUp && !isInverting)
        ) {
          nav.prevTab();
          return;
        }
        if ((isRight && !isInverting) || (isLeft && isInverting)) {
          nav.setActiveDepth(1);
        }
      }
      if (nav.activeDepth == 1) {
      }
    },
    { release: false },
  );

  return (
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
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        backgroundColor={
          themeContext.selected === "system"
            ? "transparent"
            : themeContext.theme.surface
        }
      >
        <LoadingIndicator />
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
        <box flexDirection="row" width="100%" height="100%">
          <TabNavigation />
          {LayerGraph[nav.activeTab]()}
        </box>
      </box>
    </ErrorBoundary>
  );
}
