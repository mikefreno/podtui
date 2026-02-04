export type SyncData = {
  version: string
  lastSyncedAt: string
  feeds: {
    id: string
    title: string
    url: string
    isPrivate: boolean
  }[]
  sources: {
    id: string
    name: string
    url: string
  }[]
  settings: {
    theme: string
    playbackSpeed: number
    downloadPath: string
  }
  preferences: {
    showExplicit: boolean
    autoDownload: boolean
  }
}
