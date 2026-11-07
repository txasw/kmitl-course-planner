// The Section 2 tone rules as patterns, shared by every test that guards copy: the
// extension's dictionaries, docs and comments, and the landing site's pages. The emoji
// pattern covers pictographs, flag pairs, and the emoji presentation selector so a
// sequence emoji is caught, not only a lone pictograph.

export const EMOJI =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{FE0F}/u;

/** Em and en dashes, arrows and symbol bullets used as punctuation. */
export const DECORATIVE = /[—–―‒−→←↔⇒⇐•●▪◦‣]/;

/** English filler words the copy never uses, matched case insensitively as substrings. */
export const BANNED: readonly string[] = [
  'seamless',
  'delve',
  'robust',
  'leverage',
  'empower',
  'elevate',
  'supercharge',
  'cutting edge',
  'effortless',
  'revolutioni',
  'game changer',
  "let's",
];

// The host registration site's own vocabulary is canonical (docs/TERMINOLOGY.md). These
// are the near synonyms the host does not use; the section term is กลุ่มเรียน, not ตอน.
// ปฏิบัติการ is listed in full so the canonical ปฏิบัติ, the practice section kind, is not
// caught.
export const BANNED_THAI = [
  'ตอน',
  'ตอนเรียน',
  'ภาคเรียน',
  'ปฏิบัติการ',
] as const;
