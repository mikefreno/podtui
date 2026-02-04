import type { SyncData } from "../types/sync-json"
import type { SyncDataXML } from "../types/sync-xml"
import { syncFormats } from "../constants/sync-formats"

const isObject = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === "object" && value !== null

const hasVersion = (value: unknown): value is { version: string } =>
  isObject(value) && typeof value.version === "string"

export function validateJSONSync(data: unknown): SyncData {
  if (!hasVersion(data) || data.version !== syncFormats.json.version) {
    throw { message: "Unsupported sync format" }
  }

  return data as SyncData
}

export function validateXMLSync(data: unknown): SyncDataXML {
  if (!hasVersion(data) || data.version !== syncFormats.xml.version) {
    throw { message: "Unsupported sync format" }
  }

  return data as SyncDataXML
}
