export type SyncDataXML = {
  version: string
  lastSyncedAt: string
  feeds: {
    feed: {
      id: string
      title: string
      url: string
      isPrivate: boolean
    }[]
  }
  sources: {
    source: {
      id: string
      name: string
      url: string
    }[]
  }
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
