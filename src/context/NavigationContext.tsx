/**
 * NavigationContext — Solid provider wrapper around the pure nav store in
 * `./navigation-store`. Re-exports the nav model (`createNavigation`, the
 * enums/types, `DEPTH_CENTER_PANE`, etc.) so the rest of the app keeps
 * importing everything from `@/context/NavigationContext`, and binds the
 * store into a Solid context (`useNavigation` / `NavigationProvider`).
 *
 * See `./navigation-store` for the model documentation (parent | current |
 * preview, depth-stack vs fixed-pane tabs, no sidebar pane).
 */
import { createSimpleContext } from "./helper";
import { createNavigation } from "./navigation-store";

// Re-export the entire nav model surface so existing imports from
// `@/context/NavigationContext` keep resolving.
export * from "./navigation-store";

export const { use: useNavigation, provider: NavigationProvider } =
	createSimpleContext({
		name: "Navigation",
		init: () => createNavigation(),
	});
