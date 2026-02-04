const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
  let current = value
  return [() => current, (next) => {
    current = next
  }]
}
import { Layout } from "./components/Layout"
import { Navigation } from "./components/Navigation"
import { TabNavigation } from "./components/TabNavigation"
import { KeyboardHandler } from "./components/KeyboardHandler"
import { SyncPanel } from "./components/SyncPanel"
import type { TabId } from "./components/Tab"

export function App() {
  const activeTab = createSignal<TabId>("discover")

  return (
    <KeyboardHandler onTabSelect={activeTab[1]}>
      <Layout
        header={
          <TabNavigation
            activeTab={activeTab[0]()}
            onTabSelect={activeTab[1]}
          />
        }
        footer={
          <Navigation activeTab={activeTab[0]()} onTabSelect={activeTab[1]} />
        }
      >
        <box style={{ padding: 1 }}>
          {activeTab[0]() === "settings" ? (
            <SyncPanel />
          ) : (
            <box border style={{ padding: 2 }}>
              <text>
                <strong>{`${activeTab[0]()}`}</strong>
                <br />
                <span>Content placeholder</span>
              </text>
            </box>
          )}
        </box>
      </Layout>
    </KeyboardHandler>
  )
}
