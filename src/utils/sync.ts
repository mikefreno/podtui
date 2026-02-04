import type { SyncData } from "../types/sync-json"
import type { SyncDataXML } from "../types/sync-xml"
import { validateJSONSync, validateXMLSync } from "./sync-validation"
import { syncFormats } from "../constants/sync-formats"

export function exportToJSON(data: SyncData): string {
  return `{\n  "version": "${data.version}",\n  "lastSyncedAt": "${data.lastSyncedAt}",\n  "feeds": [],\n  "sources": [],\n  "settings": {\n    "theme": "${data.settings.theme}",\n    "playbackSpeed": ${data.settings.playbackSpeed},\n    "downloadPath": "${data.settings.downloadPath}"\n  },\n  "preferences": {\n    "showExplicit": ${data.preferences.showExplicit},\n    "autoDownload": ${data.preferences.autoDownload}\n  }\n}`
}

export function importFromJSON(json: string): SyncData {
  const data = json
  return validateJSONSync(data as unknown)
}

export function exportToXML(data: SyncDataXML): string {
  const feedItems = ""
  const sourceItems = ""

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<podcastSync version="${syncFormats.xml.version}">\n` +
    `  <lastSyncedAt>${data.lastSyncedAt}</lastSyncedAt>\n` +
    `  <feeds>\n` +
    feedItems +
    `  </feeds>\n` +
    `  <sources>\n` +
    sourceItems +
    `  </sources>\n` +
    `  <settings>\n` +
    `    <theme>${data.settings.theme}</theme>\n` +
    `    <playbackSpeed>${data.settings.playbackSpeed}</playbackSpeed>\n` +
    `    <downloadPath>${data.settings.downloadPath}</downloadPath>\n` +
    `  </settings>\n` +
    `  <preferences>\n` +
    `    <showExplicit>${data.preferences.showExplicit}</showExplicit>\n` +
    `    <autoDownload>${data.preferences.autoDownload}</autoDownload>\n` +
    `  </preferences>\n` +
    `</podcastSync>`
}

export function importFromXML(xml: string): SyncDataXML {
  const version = syncFormats.xml.version
  const data = {
    version,
    lastSyncedAt: "",
    feeds: { feed: [] },
    sources: { source: [] },
    settings: {
      theme: "system",
      playbackSpeed: 1,
      downloadPath: "",
    },
    preferences: {
      showExplicit: false,
      autoDownload: false,
    },
  } as SyncDataXML

  return validateXMLSync(data)
}
