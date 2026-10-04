export type PrivacyMode = "smart" | "strict" | "off";

export type EntityType =
  | "PERSON"
  | "NAME"
  | "CITY"
  | "PLACE"
  | "COUNTRY"
  | "ADDRESS"
  | "POSTCODE"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "IP"
  | "CARD"
  | "IBAN"
  | "ID"
  | "WALLET"
  | "TX"
  | "SECRET"
  | "ORG"
  | "DATE"
  | "NUM"
  | "HANDLE";

export interface DetectedEntity {
  type: EntityType;
  value: string;
  start: number;
  end: number;
  /** Higher wins when spans overlap. */
  priority: number;
}

export interface PlaceholderEntry {
  type: EntityType;
  value: string;
}

/**
 * Conversation-scoped mapping between placeholders and the original values.
 * It is created and stored in the browser (IndexedDB) and never sent to the server.
 */
export interface PlaceholderMap {
  version: 1;
  byPlaceholder: Record<string, PlaceholderEntry>;
  /** normalized original value → placeholder, so repeats stay stable */
  byValue: Record<string, string>;
  counters: Partial<Record<EntityType, number>>;
}

export interface Replacement {
  placeholder: string;
  type: EntityType;
  value: string;
}

export interface SanitizeResult {
  mode: PrivacyMode;
  original: string;
  sanitized: string;
  replacements: Replacement[];
  warnings: string[];
  map: PlaceholderMap;
}
