import { createEffect, createSignal, on } from "solid-js";
import { createSimpleContext } from "./helper";
import { TABS, TabsCount, LayerDepths } from "@/utils/navigation";

// Page-specific pane counts
const PANE_COUNTS = {
  [TABS.FEED]: 1,
  [TABS.MYSHOWS]: 2,
  [TABS.DISCOVER]: 2,
  [TABS.SEARCH]: 3,
  [TABS.PLAYER]: 1,
  [TABS.SETTINGS]: 5,
};

export const { use: useNavigation, provider: NavigationProvider } =
  createSimpleContext({
    name: "Navigation",
    init: () => {
      const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
      const [activeDepth, setActiveDepth] = createSignal(0);
      const [inputFocused, setInputFocused] = createSignal(false);

      createEffect(
        on(
          () => activeTab,
          () => setActiveDepth(0),
        ),
      );

      const nextTab = () => {
        if (activeTab() >= TabsCount) {
          setActiveTab(1);
          return;
        }
        setActiveTab(activeTab() + 1);
      };

      const prevTab = () => {
        if (activeTab() <= 1) {
          setActiveTab(TabsCount);
          return;
        }
        setActiveTab(activeTab() - 1);
      };

      const nextPane = () => {
        // Move to next pane within the current tab's pane structure
        const count = PANE_COUNTS[activeTab()];
        if (count <= 1) return; // No panes to navigate (feed/player)
        setActiveDepth((prev) => (prev % count) + 1);
      };

      const prevPane = () => {
        // Move to previous pane within the current tab's pane structure
        const count = PANE_COUNTS[activeTab()];
        if (count <= 1) return; // No panes to navigate (feed/player)
        setActiveDepth((prev) => (prev - 2 + count) % count + 1);
      };

      return {
        activeTab,
        activeDepth,
        inputFocused,
        setActiveTab,
        setActiveDepth,
        setInputFocused,
        nextTab,
        prevTab,
        nextPane,
        prevPane,
      };
    },
  });
