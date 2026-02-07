import { createSignal, createMemo, ErrorBoundary, Accessor } from "solid-js";
import { useSelectionHandler } from "@opentui/solid";
import { TabNavigation } from "./components/TabNavigation";
import { FeedPage } from "@/tabs/Feed/FeedPage";
import { MyShowsPage } from "@/tabs/MyShows/MyShowsPage";
import { LoginScreen } from "@/tabs/Settings/LoginScreen";
import { CodeValidation } from "@/components/CodeValidation";
import { OAuthPlaceholder } from "@/tabs/Settings/OAuthPlaceholder";
import { SyncProfile } from "@/tabs/Settings/SyncProfile";
import { SearchPage } from "@/tabs/Search/SearchPage";
import { DiscoverPage } from "@/tabs/Discover/DiscoverPage";
import { SettingsScreen } from "@/tabs/Settings/SettingsScreen";
import { useAuthStore } from "@/stores/auth";
import { useFeedStore } from "@/stores/feed";
import { useAudio } from "@/hooks/useAudio";
import { useMultimediaKeys } from "@/hooks/useMultimediaKeys";
import { FeedVisibility } from "@/types/feed";
import { useAppKeyboard } from "@/hooks/useAppKeyboard";
import { Clipboard } from "@/utils/clipboard";
import { useToast } from "@/ui/toast";
import { useRenderer } from "@opentui/solid";
import type { AuthScreen } from "@/types/auth";
import type { Episode } from "@/types/episode";
import { DIRECTION } from "./types/navigation";
import { LayerGraph, TABS } from "./utils/navigation";
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

  useAppKeyboard({
    layerDepth,
    onAction: (action, direction) => {
      if (action == "cycle") {
        if (direction == DIRECTION.Increment) {
          //if()
        }
        if (direction == DIRECTION.Decrement) {
        }
      }
      if (action == "depth") {
        if (direction == DIRECTION.Increment) {
        }
        if (direction == DIRECTION.Decrement) {
        }
      }

      if (action === "escape") {
        if (layerDepth() > 0) {
          setLayerDepth(0);
          setInputFocused(false);
        } else {
          setShowAuthPanel(false);
          setInputFocused(false);
        }
      }
    },
  });

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

  const { theme } = useTheme();
  return (
    <ErrorBoundary
      fallback={(err) => (
        <box border padding={2}>
          <text fg="red">
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
      </box>
    </ErrorBoundary>
  );
}
