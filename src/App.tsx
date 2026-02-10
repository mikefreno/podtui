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
import { DIRECTION, LayerGraph, TABS } from "./utils/navigation";
import { useTheme } from "./context/ThemeContext";

export interface PageProps {
  depth: Accessor<number>;
}

export function App() {
  const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
  const [activeDepth, setActiveDepth] = createSignal(0); // not fixed matrix size
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login");
  const [showAuthPanel, setShowAuthPanel] = createSignal(false);
  const [inputFocused, setInputFocused] = createSignal(false);
  const [layerDepth, setLayerDepth] = createSignal(0);
  const auth = useAuthStore();
  const feedStore = useFeedStore();
  const audio = useAudio();
  const toast = useToast();
  const renderer = useRenderer();
  const { theme } = useTheme();

  useMultimediaKeys({
    playerFocused: () => activeTab() === TABS.PLAYER && layerDepth() > 0,
    inputFocused: () => inputFocused(),
    hasEpisode: () => !!audio.currentEpisode(),
  });

  const handlePlayEpisode = (episode: Episode) => {
    audio.play(episode);
    setActiveTab(TABS.PLAYER);
    setLayerDepth(1);
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
      //handle intra layer navigation
      if (keyEvent.name == "up" || keyEvent.name) {
      }
    },
    { release: false }, // Not strictly necessary
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
        flexDirection="row"
        width="100%"
        height="100%"
        backgroundColor={theme.surface}
      >
        <TabNavigation activeTab={activeTab()} onTabSelect={setActiveTab} />
        {LayerGraph[activeTab()]({ depth: activeDepth })}
        {/**TODO: Contextual controls based on tab/depth**/}
      </box>
    </ErrorBoundary>
  );
}
