import {
	createContext,
	createMemo,
	createSignal,
	onCleanup,
	useContext,
	type Accessor,
	type ParentProps,
	For,
	Show,
} from "solid-js";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { KeybindsResolved, useKeybinds } from "../context/KeybindContext";
import { useDialog } from "./dialog";
import { useTheme } from "../context/ThemeContext";
import { TextAttributes } from "@opentui/core";
import { emit } from "../utils/event-bus";
import { SelectableBox, SelectableText } from "@/components/Selectable";

/**
 * Command option for the command palette.
 */
export type CommandOption = {
	/** Display title */
	title: string;
	/** Unique identifier */
	value: string;
	/** Description shown below title */
	description?: string;
	/** Category for grouping */
	category?: string;
	/** Keybind reference */
	keybind?: keyof KeybindsResolved;
	/** Whether this command is suggested */
	suggested?: boolean;
	/** Slash command configuration */
	slash?: {
		name: string;
		aliases?: string[];
	};
	/** Whether to hide from command list */
	hidden?: boolean;
	/** Whether command is enabled */
	enabled?: boolean;
	/** Footer text (usually keybind display) */
	footer?: string;
	/** Handler when command is selected */
	onSelect?: (dialog: ReturnType<typeof useDialog>) => void;
};

type CommandContext = ReturnType<typeof init>;
const ctx = createContext<CommandContext>();

function init() {
	const [registrations, setRegistrations] = createSignal<
		Accessor<CommandOption[]>[]
	>([]);
	const [suspendCount, setSuspendCount] = createSignal(0);
	const dialog = useDialog();
	const keybind = useKeybinds();

	const entries = createMemo(() => {
		const all = registrations().flatMap((x) => x());
		return all.map((x) => ({
			...x,
			footer: x.keybind ? keybind.print(x.keybind) : undefined,
		}));
	});

	const isEnabled = (option: CommandOption) => option.enabled !== false;
	const isVisible = (option: CommandOption) =>
		isEnabled(option) && !option.hidden;

	const visibleOptions = createMemo(() =>
		entries().filter((option) => isVisible(option)),
	);
	const suggestedOptions = createMemo(() =>
		visibleOptions()
			.filter((option) => option.suggested)
			.map((option) => ({
				...option,
				value: `suggested:${option.value}`,
				category: "Suggested",
			})),
	);
	const suspended = () => suspendCount() > 0;

	useKeyboard((evt) => {
		if (suspended()) return;
		if (dialog.isOpen) return;
		for (const option of entries()) {
			if (!isEnabled(option)) continue;
			if (option.keybind && keybind.match(option.keybind, evt)) {
				evt.preventDefault();
				option.onSelect?.(dialog);
				emit("command.execute", { command: option.value });
				return;
			}
		}
	});

	const result = {
		/**
		 * Trigger a command by its value.
		 */
		trigger(name: string) {
			for (const option of entries()) {
				if (option.value === name) {
					if (!isEnabled(option)) return;
					option.onSelect?.(dialog);
					emit("command.execute", { command: name });
					return;
				}
			}
		},
		/**
		 * Get all slash commands.
		 */
		slashes() {
			return visibleOptions().flatMap((option) => {
				const slash = option.slash;
				if (!slash) return [];
				return {
					display: "/" + slash.name,
					description: option.description ?? option.title,
					aliases: slash.aliases?.map((alias) => "/" + alias),
					onSelect: () => result.trigger(option.value),
				};
			});
		},
		/**
		 * Enable/disable keybinds temporarily.
		 */
		keybinds(enabled: boolean) {
			setSuspendCount((count) => count + (enabled ? -1 : 1));
		},
		suspended,
		/**
		 * Show the command palette dialog.
		 */
		show() {
			dialog.replace(() => (
				<CommandDialog
					options={visibleOptions()}
					suggestedOptions={suggestedOptions()}
				/>
			));
		},
		/**
		 * Register commands. Returns cleanup function.
		 */
		register(cb: () => CommandOption[]) {
			const results = createMemo(cb);
			setRegistrations((arr) => [results, ...arr]);
			onCleanup(() => {
				setRegistrations((arr) => arr.filter((x) => x !== results));
			});
		},
		/**
		 * Get all visible options.
		 */
		get options() {
			return visibleOptions();
		},
	};
	return result;
}

export function useCommandDialog() {
	const value = useContext(ctx);
	if (!value) {
		throw new Error("useCommandDialog must be used within a CommandProvider");
	}
	return value;
}

export function CommandProvider(props: ParentProps) {
	const value = init();
	const dialog = useDialog();
	const keybind = useKeybinds();

	// Open the command palette via the `command` keybind (bound to `:` or `q`
	// in keybinds.jsonc; the Shell router owns the action and runs it first).
	useKeyboard((evt) => {
		if (value.suspended()) return;
		if (dialog.isOpen) return;
		if (evt.defaultPrevented) return;
		if (keybind.match("command", evt)) {
			evt.preventDefault();
			value.show();
			return;
		}
	});

	return <ctx.Provider value={value}>{props.children}</ctx.Provider>;
}

/**
 * Command palette dialog component.
 */
function CommandDialog(props: {
	options: CommandOption[];
	suggestedOptions: CommandOption[];
}) {
	const { theme } = useTheme();
	const dialog = useDialog();
	const dimensions = useTerminalDimensions();
	const [filter, setFilter] = createSignal("");
	const [selectedIndex, setSelectedIndex] = createSignal(0);

	const filteredOptions = createMemo(() => {
		const query = filter().toLowerCase();
		if (!query) {
			return [...props.suggestedOptions, ...props.options];
		}
		return props.options.filter(
			(option) =>
				option.title.toLowerCase().includes(query) ||
				option.description?.toLowerCase().includes(query) ||
				option.category?.toLowerCase().includes(query),
		);
	});

	// Reset selection when filter changes
	createMemo(() => {
		filter();
		setSelectedIndex(0);
	});

	useKeyboard((evt) => {
		if (evt.name === "escape") {
			dialog.clear();
			evt.preventDefault();
			return;
		}

		if (evt.name === "return" || evt.name === "enter") {
			const option = filteredOptions()[selectedIndex()];
			if (option) {
				option.onSelect?.(dialog);
				dialog.clear();
			}
			evt.preventDefault();
			return;
		}

		if (evt.name === "up" || (evt.ctrl && evt.name === "p")) {
			setSelectedIndex((i) => Math.max(0, i - 1));
			evt.preventDefault();
			return;
		}

		if (evt.name === "down" || (evt.ctrl && evt.name === "n")) {
			setSelectedIndex((i) => Math.min(filteredOptions().length - 1, i + 1));
			evt.preventDefault();
			return;
		}

		if (evt.name && evt.name.length === 1 && !evt.ctrl && !evt.meta) {
			setFilter((f) => f + evt.name);
			return;
		}

		if (evt.name === "backspace") {
			setFilter((f) => f.slice(0, -1));
			return;
		}
	});

	const maxHeight = Math.floor(dimensions().height * 0.6);

	return (
		<box flexDirection="column" padding={1} borderColor={theme.border}>
			{/* Search input */}
			<box marginBottom={1}>
				<text fg={theme.textMuted}>{"> "}</text>
				<text fg={theme.text}>{filter() || "Type to search commands..."}</text>
			</box>

			{/* Command list */}
			<box
				flexDirection="column"
				maxHeight={maxHeight}
				borderColor={theme.border}
			>
				<For each={filteredOptions().slice(0, 10)}>
					{(option, index) => (
						<SelectableBox
							selected={() => index() === selectedIndex()}
							flexDirection="column"
							padding={1}
							onMouseDown={() => {
								setSelectedIndex(index());
								const selectedOption = filteredOptions()[index()];
								if (selectedOption) {
									selectedOption.onSelect?.(dialog);
									dialog.clear();
								}
							}}
						>
							<box flexDirection="column" flexGrow={1}>
								<SelectableText
									selected={() => index() === selectedIndex()}
									primary
								>
									{option.title}
								</SelectableText>
								<Show when={option.footer}>
									<SelectableText
										selected={() => index() === selectedIndex()}
										tertiary
									>
										{option.footer}
									</SelectableText>
								</Show>
								<Show when={option.description}>
									<SelectableText
										selected={() => index() === selectedIndex()}
										tertiary
									>
										{option.description}
									</SelectableText>
								</Show>
							</box>
						</SelectableBox>
					)}
				</For>
				<Show when={filteredOptions().length === 0}>
					<text fg={theme.textMuted} style={{ padding: 1 }}>
						No commands found
					</text>
				</Show>
			</box>
		</box>
	);
}
