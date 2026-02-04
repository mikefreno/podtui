import { SourceType } from "../types/source"

type SourceBadgeProps = {
  sourceId: string
  sourceName?: string
  sourceType?: SourceType
}

const typeLabel = (sourceType?: SourceType) => {
  if (sourceType === SourceType.API) return "API"
  if (sourceType === SourceType.RSS) return "RSS"
  if (sourceType === SourceType.CUSTOM) return "Custom"
  return "Source"
}

const typeColor = (sourceType?: SourceType) => {
  if (sourceType === SourceType.API) return "cyan"
  if (sourceType === SourceType.RSS) return "green"
  if (sourceType === SourceType.CUSTOM) return "yellow"
  return "gray"
}

export function SourceBadge(props: SourceBadgeProps) {
  const label = () => props.sourceName || props.sourceId

  return (
    <box flexDirection="row" gap={1} padding={0}>
      <text fg={typeColor(props.sourceType)}>
        [{typeLabel(props.sourceType)}]
      </text>
      <text fg="gray">{label()}</text>
    </box>
  )
}
