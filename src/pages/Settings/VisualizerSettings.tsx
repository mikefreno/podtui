/**
 * VisualizerSettings — exposes bars/sensitivity/noise/lowCut/highCut as
 * SettingItems for the yazi depth-stack. No own useKeyboard.
 */

import { useAppStore } from "@/stores/app";
import type { SettingItem } from "./types";

export function useVisualizerItems(): SettingItem[] {
	const app = useAppStore();
	const viz = () => app.state().settings.visualizer;

	return [
		{
			id: "enabled",
			label: "Waveform",
			kind: "toggle",
			display: () => (viz().enabled ? "On" : "Off"),
			help: () =>
				`Realtime waveform visualizer in the player.\nType: toggle\nDefault: on\nCurrent: ${viz().enabled ? "on" : "off"}\nSpace/Enter to toggle.`,
			toggle: () => app.updateVisualizer({ enabled: !viz().enabled }),
		},
		{
			id: "bars",
			label: "Bars",
			kind: "number",
			display: () => String(viz().bars),
			help: () =>
				`Number of visualizer bars.\nType: number (8–128, step 8)\nDefault: 64\nCurrent: ${viz().bars}\nj/k to −/+8.`,
			cycle: (dir) =>
				app.updateVisualizer({
					bars: Math.min(128, Math.max(8, viz().bars + dir * 8)),
				}),
		},
		{
			id: "sensitivity",
			label: "Auto Sensitivity",
			kind: "toggle",
			display: () => (viz().sensitivity === 1 ? "On" : "Off"),
			help: () =>
				`Automatic gain sensitivity.\nType: toggle\nDefault: on\nCurrent: ${viz().sensitivity === 1 ? "on" : "off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updateVisualizer({
					sensitivity: viz().sensitivity === 1 ? 0 : 1,
				}),
		},
		{
			id: "noiseReduction",
			label: "Noise Reduction",
			kind: "number",
			display: () => viz().noiseReduction.toFixed(2),
			help: () =>
				`FFT noise reduction factor.\nType: number (0.00–1.00, step 0.05)\nDefault: 0.20\nCurrent: ${viz().noiseReduction.toFixed(2)}\nj/k to −/+0.05.`,
			cycle: (dir) =>
				app.updateVisualizer({
					noiseReduction: Math.min(
						1,
						Math.max(0, Number((viz().noiseReduction + dir * 0.05).toFixed(2))),
					),
				}),
		},
		{
			id: "lowCutOff",
			label: "Low Cutoff",
			kind: "number",
			display: () => `${viz().lowCutOff} Hz`,
			help: () =>
				`Lower frequency cutoff.\nType: number (20–500 Hz, step 10)\nDefault: 20\nCurrent: ${viz().lowCutOff}\nj/k to −/+10.`,
			cycle: (dir) =>
				app.updateVisualizer({
					lowCutOff: Math.min(500, Math.max(20, viz().lowCutOff + dir * 10)),
				}),
		},
		{
			id: "highCutOff",
			label: "High Cutoff",
			kind: "number",
			display: () => `${viz().highCutOff} Hz`,
			help: () =>
				`Upper frequency cutoff.\nType: number (1000–20000 Hz, step 500)\nDefault: 20000\nCurrent: ${viz().highCutOff}\nj/k to −/+500.`,
			cycle: (dir) =>
				app.updateVisualizer({
					highCutOff: Math.min(
						20000,
						Math.max(1000, viz().highCutOff + dir * 500),
					),
				}),
		},
	];
}
