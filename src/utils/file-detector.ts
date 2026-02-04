export type DetectedFormat = "json" | "xml" | "unknown"

export function detectFormat(filePath: string): DetectedFormat {
  const length = filePath.length
  const jsonSuffix = length >= 5 ? filePath.substr(length - 5) : ""
  const xmlSuffix = length >= 4 ? filePath.substr(length - 4) : ""
  if (jsonSuffix === ".json" || jsonSuffix === ".JSON") return "json"
  if (xmlSuffix === ".xml" || xmlSuffix === ".XML") return "xml"
  return "unknown"
}
