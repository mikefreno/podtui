/**
 * SourceManager — exposes podcast sources as SettingItems for the depth-stack.
 *
 *   • "Add Source" — an editor item; drilling in shows a name/URL add form.
 *   • Each source — a toggle item (Space toggles enabled) whose display shows
 *     the source type and on/off state.
 *
 * Advanced per-API-source options (country/language/explicit) are flattened to
 * simple toggles/cycles reachable by drilling into the source's editor.
 * Movement flows through nav.action — no own useKeyboard (avoids the old
 * right-pane key conflicts).
 */

import { createSignal, For, Show } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useTheme } from "@/context/ThemeContext";
import { SourceType } from "@/types/source";
import type { PodcastSource } from "@/types/source";
import type { SettingItem } from "./types";

export function useSourceItems(): SettingItem[] {
	const feedStore = useFeedStore();

	const typeBadge = (s: PodcastSource) =>
		s.type === SourceType.API
			? "[API]"
			: s.type === SourceType.RSS
				? "[RSS]"
				: "[?]";

	const items: SettingItem[] = [
		{
			id: "add",
			label: "Add Source",
			kind: "editor",
			display: () => "+",
			help: () =>
				`Add a custom RSS feed by URL.\nDrill in (Enter/l) to open the add-source form.\nType: editor`,
			renderEditor: () => <AddSourceForm />,
		},
	];

	for (const s of feedStore.sources()) {
		items.push({
			id: `src:${s.id}`,
			label: s.name,
			kind: "toggle",
			display: () => `${typeBadge(s)} ${s.enabled ? "on" : "off"}`,
			help: () =>
				`Source: ${s.name}\nType: ${s.type}\nEnabled: ${s.enabled}\nURL: ${s.baseUrl ?? "(none)"}\nSpace/Enter to toggle.`,
			toggle: () => feedStore.toggleSource(s.id),
		});
	}

	return items;
}

function AddSourceForm() {
	const feedStore = useFeedStore();
	const { theme } = useTheme();
	const [name, setName] = createSignal("");
	const [url, setUrl] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);

	const submit = () => {
		const u = url().trim();
		if (!u) {
			setError("URL is required");
			return;
		}
		try {
			new URL(u);
		} catch {
			setError("Invalid URL format");
			return;
		}
		feedStore.addSource({
			name: name().trim() || "Custom Source",
			type: SourceType.RSS,
			baseUrl: u,
			enabled: true,
			description: `Custom RSS feed: ${u}`,
		});
		setName("");
		setUrl("");
		setError(null);
	};

	return (
		<box flexDirection="column" padding={1} gap={1}>
			<text fg={theme.text}>
				<strong>Add Source</strong>
			</text>
			<box flexDirection="row" gap={1}>
				<text fg={theme.textMuted}>Name:</text>
				<input
					value={name()}
					onInput={setName}
					placeholder="My Custom Feed"
					width={25}
				/>
			</box>
			<box flexDirection="row" gap={1}>
				<text fg={theme.textMuted}>URL:</text>
				<input
					value={url()}
					onInput={(v) => {
						setUrl(v);
						setError(null);
					}}
					placeholder="https://example.com/feed.rss"
					width={35}
				/>
			</box>
			<box
				border
				borderColor={theme.border}
				padding={0}
				width={15}
				onMouseDown={submit}
			>
				<text fg={theme.primary}>[+] Add</text>
			</box>
			<Show when={error()}>{(e) => <text fg={theme.error}>{e()}</text>}</Show>
			<Show when={feedStore.sources().length > 0}>
				<box flexDirection="column" marginTop={1}>
					<text fg={theme.textMuted}>
						Current sources ({feedStore.sources().length}):
					</text>
					<For each={feedStore.sources()}>
						{(s) => (
							<text fg={theme.textMuted}>
								{s.enabled ? "●" : "○"} {s.name}
							</text>
						)}
					</For>
				</box>
			</Show>
		</box>
	);
}
