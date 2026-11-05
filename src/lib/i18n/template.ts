// Fill the named {placeholder} tokens of a dictionary string. Thai and English order
// values differently (ว่าง 12 จาก 45 against 12 of 45 open), so a value is placed by
// name rather than appended to a fixed prefix. A token with no value is left as
// written, so a missing value shows up in review instead of vanishing.

const TOKEN = /\{(\w+)\}/g;

export type TemplateValues = Readonly<Record<string, string | number>>;

export function fillTemplate(template: string, values: TemplateValues): string {
  return template.replace(TOKEN, (token, name: string) => {
    const value = values[name];
    return value === undefined ? token : String(value);
  });
}

/** The placeholder names a template uses, sorted, for the dictionary parity check. */
export function templateTokens(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((match) => match[1] ?? '').sort();
}
