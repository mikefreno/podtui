/**
 * CategoryFilter component - Horizontal category filter tabs
 */

import { For } from "solid-js";
import type { DiscoverCategory } from "@/stores/discover";

type CategoryFilterProps = {
  categories: DiscoverCategory[];
  selectedCategory: string;
  focused: boolean;
  onSelect?: (categoryId: string) => void;
};

export function CategoryFilter(props: CategoryFilterProps) {
  return (
    <box flexDirection="row" gap={1} flexWrap="wrap">
      <For each={props.categories}>
        {(category) => {
          const isSelected = () => props.selectedCategory === category.id;

          return (
            <box
              padding={0}
              paddingLeft={1}
              paddingRight={1}
              border={isSelected()}
              backgroundColor={isSelected() ? "#444" : undefined}
              onMouseDown={() => props.onSelect?.(category.id)}
            >
              <text fg={isSelected() ? "cyan" : "gray"}>
                {category.icon} {category.name}
              </text>
            </box>
          );
        }}
      </For>
    </box>
  );
}
