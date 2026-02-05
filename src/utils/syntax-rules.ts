import type { RGBA } from "@opentui/core"

export type SyntaxRule = {
  scope: string[]
  style: {
    foreground?: RGBA
    background?: RGBA
    bold?: boolean
    italic?: boolean
    underline?: boolean
  }
}

export function getSyntaxRules(theme: Record<string, RGBA>): SyntaxRule[] {
  return [
    { scope: ["default"], style: { foreground: theme.text } },
    { scope: ["comment", "comment.documentation"], style: { foreground: theme.syntaxComment, italic: true } },
    { scope: ["string", "symbol", "character.special"], style: { foreground: theme.syntaxString } },
    { scope: ["number", "boolean", "constant"], style: { foreground: theme.syntaxNumber } },
    { scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"], style: { foreground: theme.syntaxKeyword, italic: true } },
    { scope: ["keyword.type", "type.definition", "class"], style: { foreground: theme.syntaxType, bold: true } },
    { scope: ["keyword.function", "function", "function.method"], style: { foreground: theme.syntaxFunction } },
    { scope: ["keyword", "keyword.import", "keyword.export"], style: { foreground: theme.syntaxKeyword, italic: true } },
    { scope: ["operator", "keyword.operator", "punctuation", "punctuation.delimiter"], style: { foreground: theme.syntaxOperator } },
    { scope: ["variable", "variable.parameter", "property"], style: { foreground: theme.syntaxVariable } },
    { scope: ["type", "module", "namespace"], style: { foreground: theme.syntaxType } },
    { scope: ["punctuation.bracket"], style: { foreground: theme.syntaxPunctuation } },
    { scope: ["markup.heading", "markup.heading.1", "markup.heading.2", "markup.heading.3", "markup.heading.4", "markup.heading.5", "markup.heading.6"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.bold", "markup.strong"], style: { foreground: theme.markdownStrong, bold: true } },
    { scope: ["markup.italic"], style: { foreground: theme.markdownEmph, italic: true } },
    { scope: ["markup.list"], style: { foreground: theme.markdownListItem } },
    { scope: ["markup.quote"], style: { foreground: theme.markdownBlockQuote, italic: true } },
    { scope: ["markup.raw", "markup.raw.block"], style: { foreground: theme.markdownCode } },
    { scope: ["markup.link", "markup.link.url", "string.special.url"], style: { foreground: theme.markdownLink, underline: true } },
    { scope: ["markup.link.label", "label"], style: { foreground: theme.markdownLinkText, underline: true } },
    { scope: ["diff.plus"], style: { foreground: theme.diffAdded, background: theme.diffAddedBg } },
    { scope: ["diff.minus"], style: { foreground: theme.diffRemoved, background: theme.diffRemovedBg } },
    { scope: ["diff.delta"], style: { foreground: theme.diffContext, background: theme.diffContextBg } },
  ]
}
