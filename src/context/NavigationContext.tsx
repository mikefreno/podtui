import { createEffect, createSignal, on } from "solid-js";
import { createSimpleContext } from "./helper";
import { TABS, TabsCount } from "@/utils/navigation";

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

      //conveniences
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

      return {
        activeTab,
        activeDepth,
        inputFocused,
        setActiveTab,
        setActiveDepth,
        setInputFocused,
        nextTab,
        prevTab,
      };
    },
  });
