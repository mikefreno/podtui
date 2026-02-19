import { createSignal } from "solid-js";
import { createSimpleContext } from "./helper";
import { TABS } from "../utils/navigation";

export const { use: useNavigation, provider: NavigationProvider } = createSimpleContext({
  name: "Navigation",
  init: () => {
    const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
    const [activeDepth, setActiveDepth] = createSignal(0);
    const [inputFocused, setInputFocused] = createSignal(false);

    return {
      get activeTab() {
        return activeTab();
      },
      get activeDepth() {
        return activeDepth();
      },
      get inputFocused() {
        return inputFocused();
      },
      setActiveTab,
      setActiveDepth,
      setInputFocused,
    };
  },
});
