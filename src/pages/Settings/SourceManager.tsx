/**
 * Source management component for PodTUI
 * Add, remove, and configure podcast sources
 */

import { createSignal, For } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useTheme } from "@/context/ThemeContext";
import { SourceType } from "@/types/source";
import type { PodcastSource } from "@/types/source";

interface SourceManagerProps {
  focused?: boolean;
  onClose?: () => void;
}

type FocusArea = "list" | "add" | "url" | "country" | "explicit" | "language";

export function SourceManager(props: SourceManagerProps) {
  const feedStore = useFeedStore();
  const { theme } = useTheme();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [focusArea, setFocusArea] = createSignal<FocusArea>("list");
  const [newSourceUrl, setNewSourceUrl] = createSignal("");
  const [newSourceName, setNewSourceName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const sources = () => feedStore.sources();

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "escape") {
      if (focusArea() !== "list") {
        setFocusArea("list");
        setError(null);
      } else if (props.onClose) {
        props.onClose();
      }
      return;
    }

    if (key.name === "tab") {
      const areas: FocusArea[] = [
        "list",
        "country",
        "language",
        "explicit",
        "add",
        "url",
      ];
      const idx = areas.indexOf(focusArea());
      const nextIdx = key.shift
        ? (idx - 1 + areas.length) % areas.length
        : (idx + 1) % areas.length;
      setFocusArea(areas[nextIdx]);
      return;
    }

    if (focusArea() === "list") {
      if (key.name === "up" || key.name === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.name === "down" || key.name === "j") {
        setSelectedIndex((i) => Math.min(sources().length - 1, i + 1));
      } else if (
        key.name === "return" ||
        key.name === "space"
      ) {
        const source = sources()[selectedIndex()];
        if (source) {
          feedStore.toggleSource(source.id);
        }
      } else if (key.name === "d" || key.name === "delete") {
        const source = sources()[selectedIndex()];
        if (source) {
          const removed = feedStore.removeSource(source.id);
          if (!removed) {
            setError("Cannot remove default sources");
          }
        }
      } else if (key.name === "a") {
        setFocusArea("add");
      }
    }

    if (focusArea() === "country") {
      if (
        key.name === "enter" ||
        key.name === "return" ||
        key.name === "space"
      ) {
        const source = sources()[selectedIndex()];
        if (source && source.type === SourceType.API) {
          const next = source.country === "US" ? "GB" : "US";
          feedStore.updateSource(source.id, { country: next });
        }
      }
    }

    if (focusArea() === "explicit") {
      if (
        key.name === "return" ||
        key.name === "space"
      ) {
        const source = sources()[selectedIndex()];
        if (source && source.type === SourceType.API) {
          feedStore.updateSource(source.id, {
            allowExplicit: !source.allowExplicit,
          });
        }
      }
    }

    if (focusArea() === "language") {
      if (
        key.name === "return" ||
        key.name === "space"
      ) {
        const source = sources()[selectedIndex()];
        if (source && source.type === SourceType.API) {
          const next = source.language === "ja_jp" ? "en_us" : "ja_jp";
          feedStore.updateSource(source.id, { language: next });
        }
      }
    }
  };

  const handleAddSource = () => {
    const url = newSourceUrl().trim();
    const name = newSourceName().trim() || `Custom Source`;

    if (!url) {
      setError("URL is required");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("Invalid URL format");
      return;
    }

    feedStore.addSource({
      name,
      type: "rss" as SourceType,
      baseUrl: url,
      enabled: true,
      description: `Custom RSS feed: ${url}`,
    });

    setNewSourceUrl("");
    setNewSourceName("");
    setFocusArea("list");
    setError(null);
  };

  const getSourceIcon = (source: PodcastSource) => {
    if (source.type === SourceType.API) return "[API]";
    if (source.type === SourceType.RSS) return "[RSS]";
    return "[?]";
  };

  const selectedSource = () => sources()[selectedIndex()];
  const isApiSource = () => selectedSource()?.type === SourceType.API;
  const sourceCountry = () => selectedSource()?.country || "US";
  const sourceExplicit = () => selectedSource()?.allowExplicit !== false;
  const sourceLanguage = () => selectedSource()?.language || "en_us";

  return (
    <box flexDirection="column" border padding={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Podcast Sources</strong>
        </text>
        <box border padding={0} onMouseDown={props.onClose}>
          <text fg={theme.primary}>[Esc] Close</text>
        </box>
      </box>

      <text fg={theme.textMuted}>Manage where to search for podcasts</text>

      {/* Source list */}
      <box border padding={1} flexDirection="column" gap={1}>
        <text fg={focusArea() === "list" ? theme.primary : theme.textMuted}>
          Sources:
        </text>
        <scrollbox height={6}>
          <For each={sources()}>
            {(source, index) => (
              <box
                flexDirection="row"
                gap={1}
                padding={0}
                backgroundColor={
                  focusArea() === "list" && index() === selectedIndex()
                    ? theme.primary
                    : undefined
                }
                onMouseDown={() => {
                  setSelectedIndex(index());
                  setFocusArea("list");
                  feedStore.toggleSource(source.id);
                }}
              >
                <text
                  fg={
                    focusArea() === "list" && index() === selectedIndex()
                      ? theme.primary
                      : theme.textMuted
                  }
                >
                  {focusArea() === "list" && index() === selectedIndex()
                    ? ">"
                    : " "}
                </text>
                <text fg={source.enabled ? theme.success : theme.error}>
                  {source.enabled ? "[x]" : "[ ]"}
                </text>
                <text fg={theme.accent}>{getSourceIcon(source)}</text>
                <text
                  fg={
                    focusArea() === "list" && index() === selectedIndex()
                      ? theme.text
                      : undefined
                  }
                >
                  {source.name}
                </text>
              </box>
            )}
          </For>
        </scrollbox>
        <text fg={theme.textMuted}>
          Space/Enter to toggle, d to delete, a to add
        </text>

        {/* API settings */}
        <box flexDirection="column" gap={1}>
          <text fg={isApiSource() ? theme.textMuted : theme.accent}>
            {isApiSource()
              ? "API Settings"
              : "API Settings (select an API source)"}
          </text>
          <box flexDirection="row" gap={2}>
            <box
              border
              padding={0}
              backgroundColor={
                focusArea() === "country" ? theme.primary : undefined
              }
            >
              <text
                fg={focusArea() === "country" ? theme.primary : theme.textMuted}
              >
                Country: {sourceCountry()}
              </text>
            </box>
            <box
              border
              padding={0}
              backgroundColor={
                focusArea() === "language" ? theme.primary : undefined
              }
            >
              <text
                fg={
                  focusArea() === "language" ? theme.primary : theme.textMuted
                }
              >
                Language:{" "}
                {sourceLanguage() === "ja_jp" ? "Japanese" : "English"}
              </text>
            </box>
            <box
              border
              padding={0}
              backgroundColor={
                focusArea() === "explicit" ? theme.primary : undefined
              }
            >
              <text
                fg={
                  focusArea() === "explicit" ? theme.primary : theme.textMuted
                }
              >
                Explicit: {sourceExplicit() ? "Yes" : "No"}
              </text>
            </box>
          </box>
          <text fg={theme.textMuted}>
            Enter/Space to toggle focused setting
          </text>
        </box>
      </box>

      {/* Add new source form */}
      <box border padding={1} flexDirection="column" gap={1}>
        <text
          fg={
            focusArea() === "add" || focusArea() === "url"
              ? theme.primary
              : theme.textMuted
          }
        >
          Add New Source:
        </text>

        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>Name:</text>
          <input
            value={newSourceName()}
            onInput={setNewSourceName}
            placeholder="My Custom Feed"
            focused={props.focused && focusArea() === "add"}
            width={25}
          />
        </box>

        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>URL:</text>
          <input
            value={newSourceUrl()}
            onInput={(v) => {
              setNewSourceUrl(v);
              setError(null);
            }}
            placeholder="https://example.com/feed.rss"
            focused={props.focused && focusArea() === "url"}
            width={35}
          />
        </box>

        <box border padding={0} width={15} onMouseDown={handleAddSource}>
          <text fg={theme.success}>[+] Add Source</text>
        </box>
      </box>

      {/* Error message */}
      {error() && <text fg={theme.error}>{error()}</text>}

      <text fg={theme.textMuted}>Tab to switch sections, Esc to close</text>
    </box>
  );
}
