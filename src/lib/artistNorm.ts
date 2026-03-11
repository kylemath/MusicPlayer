/**
 * Artist name normalization + grouping.
 *
 * Two-stage pipeline:
 *   1. Local rules  — instant, handles feat/ft/& suffixes, case dupes (~90% of cases).
 *   2. LLM overrides — stored in IndexedDB, applied on top of stage-1 results.
 *      Lets the user fix edge cases (Jay Z / JAY-Z, abbreviations, typos, etc.)
 *      via the "Group with AI" button in the sidebar.
 */

// ── Stage-1 patterns ──────────────────────────────────────────────────────────

// "artist feat. X", "artist ft X", "artist w/ X", "artist Featuring X"
const FEAT_RE = /\s+(feat\.?|ft\.?|featuring|w\/)\s+.+$/i;

// "artist & X", "artist + X" — strips collab artists; users can add overrides
// for established duos like "Simon & Garfunkel" via LLM or manual override.
const AMP_RE = /\s+[&+]\s+.+$/;

// "artist vs. X", "artist versus X"
const VS_RE = /\s+(vs\.?|versus)\s+.+$/i;

// Trailing parentheticals:  "Artist (Clean)", "Artist [Radio Edit]"
const PAREN_SUFFIX_RE = /\s*[\(\[].*[\)\]]\s*$/;

export function extractPrimaryArtist(raw: string): string {
  const name = raw
    .replace(FEAT_RE, '')
    .replace(AMP_RE, '')
    .replace(VS_RE, '')
    .replace(PAREN_SUFFIX_RE, '')
    .trim();
  return name || raw.trim();
}

/** Case-insensitive key for deduplication. */
export function artistGroupKey(name: string): string {
  return name.toLowerCase().trim();
}

/** Apply stage-1 normalization then any LLM/manual overrides. */
export function getCanonicalArtist(
  raw: string,
  overrides: Record<string, string>,
): string {
  const stage1 = extractPrimaryArtist(raw);
  // Check override keyed by stage-1 result first (most common), then by raw.
  return overrides[stage1] ?? overrides[raw] ?? stage1;
}

// ── Group building ────────────────────────────────────────────────────────────

export interface ArtistGroup {
  /** Display name. */
  canonical: string;
  /** Lowercase key for comparisons and filterValue. */
  key: string;
  /** How many distinct raw artist strings collapsed here (badge number). */
  variantCount: number;
}

/**
 * Build a sorted, deduplicated list of canonical artist groups from an array
 * of songs.  Pass `overrides` (loaded from IndexedDB) to apply LLM/manual
 * corrections on top of the local normalization.
 */
export function buildArtistGroups(
  songs: ReadonlyArray<{ artist: string }>,
  overrides: Record<string, string> = {},
): ArtistGroup[] {
  // key → { canonical, rawNames }
  const map = new Map<string, { canonical: string; rawNames: Set<string> }>();

  for (const song of songs) {
    const canonical = getCanonicalArtist(song.artist, overrides);
    const key = artistGroupKey(canonical);

    if (!map.has(key)) {
      map.set(key, { canonical, rawNames: new Set() });
    }

    const entry = map.get(key)!;
    entry.rawNames.add(song.artist);

    // Among overriding canonical names, prefer the shortest / simplest form
    // when there's no explicit override set.  The LLM overrides win outright.
    if (!overrides[extractPrimaryArtist(song.artist)] && !overrides[song.artist]) {
      if (canonical.length < entry.canonical.length) {
        entry.canonical = canonical;
      }
    }
  }

  return Array.from(map.values())
    .map(({ canonical, rawNames }) => ({
      canonical,
      key: artistGroupKey(canonical),
      variantCount: rawNames.size,
    }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical));
}

// ── LLM helpers ───────────────────────────────────────────────────────────────

/**
 * Build the prompt sent to the LLM.
 * We only send names that still have case / spelling ambiguities after local
 * normalization — i.e., where multiple keys produce the same text ignoring
 * punctuation / spaces / case, or where the user wants deeper inspection.
 */
export function buildGroupingPrompt(canonicalNames: string[]): string {
  const list = canonicalNames.map(n => `  ${n}`).join('\n');
  return `You are organizing a music library. Below is a list of artist names that have already had "feat.", "&", and "vs." collaborators stripped. Some entries may still be the same artist written differently (capitalization, hyphens, abbreviations, typos, etc.).

Return a single JSON object mapping each VARIANT to its CANONICAL (most natural) spelling. Only include entries where you are very confident the two names refer to the same artist. Do NOT group artists who are genuinely different people. Do NOT add explanation — return ONLY valid JSON.

Example:
{"jay z": "Jay-Z", "JAY Z": "Jay-Z", "The Notorious B.I.G": "The Notorious B.I.G."}

Artist names:
${list}

JSON:`;
}

/**
 * Parse the LLM's raw text response into a clean override record.
 * Tolerates markdown code fences and trailing commas.
 */
export function parseLLMOverrides(raw: string): Record<string, string> {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```[a-z]*\n?/im, '')
    .replace(/```$/m, '')
    .trim();
  // Remove trailing commas before } or ] (common LLM mistake)
  const fixedJson = cleaned.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(fixedJson) as Record<string, string>;
}
