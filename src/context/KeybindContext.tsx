import { createSignal, onMount } from "solid-js";
import { createSimpleContext } from "./helper";
import {
  copyKeybindsIfNeeded,
  loadKeybindsFromFile,
  saveKeybindsToFile,
} from "../utils/keybinds-persistence";
import { createStore } from "solid-js/store";

export type KeybindsResolved = {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  cycle: string[]; // this will cycle no matter the depth/orientation
  dive: string[];
  out: string[];
  inverseModifier: string;
  leader: string; // will not trigger while focused on input
  quit: string[];
  "audio-toggle": string[];
  "audio-pause": [];
  "audio-play": string[];
  "audio-next": string[];
  "audio-prev": string[];
  "audio-seek-forward": string[];
  "audio-seek-backward": string[];
};

export enum KeybindAction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
  CYCLE,
  DIVE,
  OUT,
  QUIT,
  AUDIO_TOGGLE,
  AUDIO_PAUSE,
  AUDIO_PLAY,
  AUDIO_NEXT,
  AUDIO_PREV,
  AUDIO_SEEK_F,
  AUDIO_SEEK_B,
}

export const { use: useKeybinds, provider: KeybindProvider } =
  createSimpleContext({
    name: "Keybinds",
    init: () => {
      const [store, setStore] = createStore({
        up: [],
        down: [],
        left: [],
        right: [],
        cycle: [],
        dive: [],
        out: [],
        inverseModifier: "",
        leader: "",
        quit: [],
        refresh: [],
        "audio-toggle": [],
        "audio-pause": [],
        "audio-play": [],
        "audio-next": [],
        "audio-prev": [],
        "audio-seek-forward": [],
        "audio-seek-backward": [],
      } as KeybindsResolved);
      const [ready, setReady] = createSignal(false);

      async function load() {
        await copyKeybindsIfNeeded();
        const keybinds = await loadKeybindsFromFile();
        setStore(keybinds);
        setReady(true);
      }

      async function save() {
        saveKeybindsToFile(store);
      }

      function print(input: keyof KeybindsResolved): string {
        const keys = store[input] || [];
        return Array.isArray(keys) ? keys.join(", ") : keys;
      }

      function match(
        keybind: keyof KeybindsResolved,
        evt: { name: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
      ): boolean {
        const keys = store[keybind];
        if (!keys) return false;

        for (const key of keys) {
          if (evt.name === key) return true;
        }
        return false;
      }

      function isInverting(evt: {
        name: string;
        ctrl?: boolean;
        meta?: boolean;
        shift?: boolean;
      }) {
        if (store.inverseModifier === "ctrl" && evt.ctrl) return true;
        if (store.inverseModifier === "meta" && evt.meta) return true;
        if (store.inverseModifier === "shift" && evt.shift) return true;
        return false;
      }

      // Load on mount
      onMount(() => {
        load().catch(() => {});
      });

      return {
        get ready() {
          return ready();
        },
        get keybinds() {
          return store;
        },
        save,
        print,
        match,
        isInverting,
      };
    },
  });
