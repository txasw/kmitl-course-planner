export const THAI_KEEP: readonly string[];
export function keepThaiWords(html: string): string;
export interface StoreBadge {
  store: 'chrome' | 'firefox';
  href: string;
  src: string;
  width: number;
  height: number;
  alt: string;
}
export const STORE_BADGES: readonly StoreBadge[];
