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

import { createSignal, For, Show, onMount } from "solid-js";
import { Renderable } from "@opentui/core";
import { useFeedStore } from "@/stores/feed";
import { useTheme } from "@/context/ThemeContext";
import { useInputFocusNav } from "@/hooks/useInputFocusNav";
import { useDialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import {
  resolveSourceCredentials,
  savePodcastIndexCredentials,
} from "@/utils/source-credentials";
import { SourceType } from "@/types/source";
import type { PodcastSource } from "@/types/source";
import type { SettingItem } from "./types";

export function useSourceItems(): SettingItem[] {
	const feedStore = useFeedStore();
	const dialog = useDialog();

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
				s.id === "podcastindex"
					? `Source: ${s.name} (open podcast directory)\nEnabled: ${s.enabled}\nSpace to ${s.enabled ? "disable" : "enable"}: enabling asks for API keys.\nKeys are masked in the UI and stored in the macOS keychain\n(encrypted at rest), falling back to config.json when the\nkeychain is unavailable; they are kept when disabled.`
					: `Source: ${s.name}\nType: ${s.type}\nEnabled: ${s.enabled}\nURL: ${s.baseUrl ?? "(none)"}\nSpace/Enter to toggle.`,
			toggle: () => {
				// Enabling Podcast Index requires credentials: ask first
				// (prefilled with the stored key, masked) instead of flipping
				// the source into a key-less "on" state. Disabling never
				// clears the stored credentials.
				if (s.id === "podcastindex" && !s.enabled) {
					dialog.push(() => <PodcastIndexCredentialsDialog />);
					return;
				}
				feedStore.toggleSource(s.id);
			},
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
	// Yield navigation keybinds to the Shell router while either input is focused.
	const nameRef = useInputFocusNav();
	const urlRef = useInputFocusNav();

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
					ref={nameRef}
					value={name()}
					onInput={setName}
					placeholder="My Custom Feed"
					width={25}
					textColor={theme.text}
					focusedTextColor={theme.accent}
					cursorColor={theme.accent}
				/>
			</box>
			<box flexDirection="row" gap={1}>
				<text fg={theme.textMuted}>URL:</text>
				<input
					ref={urlRef}
					value={url()}
					onInput={(v) => {
						setUrl(v);
						setError(null);
					}}
					placeholder="https://example.com/feed.rss"
					width={35}
					textColor={theme.text}
					focusedTextColor={theme.accent}
					cursorColor={theme.accent}
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

/** Mask a stored credential for prefill: first 3 chars then "...". */
const maskCredential = (value: string): string => `${value.slice(0, 3)}...`;

/** Credentials popup shown when enabling the Podcast Index source. Prefilled
 *  (masked) with stored credentials so re-enabling just needs Enter; leaving
 *  a masked field untouched keeps the stored value. Credentials are saved to
 *  the macOS keychain (encrypted at rest) with a plaintext config.json
 *  fallback when the keychain is unavailable. */
function PodcastIndexCredentialsDialog() {
	const feedStore = useFeedStore();
	const { theme } = useTheme();
	const dialog = useDialog();
	const toast = useToast();
	const source = feedStore.sources().find((s) => s.id === "podcastindex");
	const [key, setKey] = createSignal("");
	const [secret, setSecret] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [saving, setSaving] = createSignal(false);
	// Yield navigation keybinds to the Shell router while an input is focused.
	const keyRef = useInputFocusNav();
	const secretRef = useInputFocusNav();
	let keyEl: Renderable | null | undefined;
	let secretEl: Renderable | null | undefined;

	onMount(() => {
		// Prefill stored credentials (masked) when re-enabling after a
		// disable — toggling off never clears them. Masked either way, so a
		// plaintext-stored key never appears in full in the UI.
		if (source) {
			resolveSourceCredentials(source)
				.then((stored) => {
					if (stored?.apiKey) setKey(maskCredential(stored.apiKey));
					if (stored?.apiSecret) setSecret(maskCredential(stored.apiSecret));
				})
				.catch(() => {});
		}
		setTimeout(() => keyEl?.focus(), 1);
	});

	const save = async () => {
		if (saving()) return;
		const stored = source
			? await resolveSourceCredentials(source).catch(() => null)
			: null;
		const keyValue = key().trim();
		const secretValue = secret().trim();
		// A field still showing its masked prefill means "keep what's stored".
		const apiKey =
			stored?.apiKey && keyValue === maskCredential(stored.apiKey)
				? stored.apiKey
				: keyValue;
		const apiSecret =
			stored?.apiSecret && secretValue === maskCredential(stored.apiSecret)
				? stored.apiSecret
				: secretValue;
		if (!apiKey || !apiSecret) {
			setError(
				"Both API key and secret are required (free at podcastindex.org)",
			);
			return;
		}
		setSaving(true);
		const ok = await savePodcastIndexCredentials(apiKey, apiSecret).catch(
			() => false,
		);
		setSaving(false);
		if (!ok) {
			// Keychain unavailable (non-macOS, locked, sandboxed): plaintext
			// fallback on the source so the fallback search still works.
			feedStore.updateSource("podcastindex", {
				hasCredentials: true,
				credentialStorage: "plaintext",
				apiKey,
				apiSecret,
				enabled: true,
			});
			toast.show({
				title: "Credentials stored in config.json",
				message: "macOS keychain unavailable — API keys saved unencrypted.",
				variant: "warning",
			});
			dialog.pop();
			return;
		}
		feedStore.updateSource("podcastindex", {
			hasCredentials: true,
			credentialStorage: "keychain",
			enabled: true,
		});
		dialog.pop();
	};

	return (
		<box
			border
			title="Podcast Index API Keys"
			padding={1}
			flexDirection="column"
			gap={1}
		>
			<text fg={theme.textMuted}>
				Free key + secret from https://podcastindex.org/. Used as a
				fallback when other sources return fewer than 3 results.
			</text>
			<box flexDirection="row" gap={1}>
				<text fg={theme.text}>API Key:</text>
				<input
					ref={(el: Renderable | null | undefined) => {
						keyRef(el);
						keyEl = el;
					}}
					value={key()}
					onInput={setKey}
					onSubmit={() => secretEl?.focus()}
					placeholder="e.g. UXKCGDSYGUUEVQJSYDZH"
					width={30}
					textColor={theme.text}
					focusedTextColor={theme.accent}
					cursorColor={theme.accent}
				/>
			</box>
			<box flexDirection="row" gap={1}>
				<text fg={theme.text}>API Secret:</text>
				<input
					ref={(el: Renderable | null | undefined) => {
						secretRef(el);
						secretEl = el;
					}}
					value={secret()}
					onInput={setSecret}
					onSubmit={() => save()}
					placeholder="e.g. yzJe2eE7XV-3eY576dyRZ6wXyAbndh6LUrCZ8KN|"
					width={40}
					textColor={theme.text}
					focusedTextColor={theme.accent}
					cursorColor={theme.accent}
				/>
			</box>
			<Show when={error()}>{(e) => <text fg={theme.error}>{e()}</text>}</Show>
			<Show when={saving()}>
				<text fg={theme.textMuted}>Storing credentials...</text>
			</Show>
			<text fg={theme.textMuted}>
				[Enter] save · [Esc] cancel — keys stay stored when disabled.
			</text>
		</box>
	);
}
