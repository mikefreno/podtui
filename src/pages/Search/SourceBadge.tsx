import { SourceType } from "@/types/source";
import { useTheme } from "@/context/ThemeContext";

type SourceBadgeProps = {
	sourceId: string;
	sourceName?: string;
	sourceType?: SourceType;
};

const typeLabel = (sourceType?: SourceType) => {
	if (sourceType === SourceType.API) return "API";
	if (sourceType === SourceType.RSS) return "RSS";
	if (sourceType === SourceType.CUSTOM) return "Custom";
	return "Source";
};

// No module-level typeColor here — it needs the theme from the component.
// The correct definition lives inside SourceBadge below.
export function SourceBadge(props: SourceBadgeProps) {
	const { theme } = useTheme();
	const label = () => props.sourceName || props.sourceId;

	const typeColor = (sourceType?: SourceType) => {
		if (sourceType === SourceType.API) return theme.primary;
		if (sourceType === SourceType.RSS) return theme.success;
		if (sourceType === SourceType.CUSTOM) return theme.warning;
		return theme.textMuted;
	};

	return (
		<box flexDirection="row" gap={1} padding={0}>
			<text fg={typeColor(props.sourceType)}>
				[{typeLabel(props.sourceType)}]
			</text>
			<text fg={theme.textMuted}>{label()}</text>
		</box>
	);
}
