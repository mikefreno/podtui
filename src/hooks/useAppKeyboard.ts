/**
 * Centralized keyboard shortcuts hook for PodTUI
 * Single handler to prevent conflicts
 */

import { TabId } from "@/components/TabNavigation";
import { useKeyboard, useRenderer } from "@opentui/solid";
import type { Accessor } from "solid-js";

type ShortcutOptions = {
  onAction?: (action: string, direction: Direction) => void;
  layerDepth: Accessor<number>;
};

export function useAppKeyboard(props: ShortcutOptions) {
  const renderer = useRenderer();

  // layer depth 0 is tabs, they are oriented
  // vertically, all others are vertically
  useKeyboard((key) => {
    // handle cycle current layer
    if (props.layerDepth() == 0) {
      let reverse = false;
      if (key.shift) {
        reverse = true;
      }
      if (key.name == "tab" || key.name == "down" || key.name == "j") {
      }
    }
    // handle cycle depth
  });
}
