// Colour tokens of the `execai ui` window.
//
// A skin names its colours once, as [light, dark] pairs; everything it draws
// refers to them by token (var(--bg), var(--accent)…), never by value. The
// theme is "as the system" unless the person picked one: then <html> carries
// data-theme="light" | "dark" (set before the first paint, see headScript in
// window/markup.ts), and the explicit choice wins over the system setting.

/** A skin's colours: token → [light, dark]. */
export type Palette = Record<string, [string, string]>;

export interface Skin {
  /** What is stored and what the picker shows: verstak | beseda | teletype. */
  id: string;
  /** The class on <html> its rules hang on. */
  cls: string;
  palette: Palette;
  css: string;
}

/**
 * The tokens every skin has to define. The contrast test walks the pairs of
 * these that the stylesheets put on top of each other (test/window.test.mjs).
 */
export const TOKENS = [
  'bg', 'panel', 'raised', 'hover', 'line', 'line2',
  'fg', 'dim', 'mute',
  'accent', 'accent-bg', 'accent-fg', 'accent-soft',
  'ok', 'warn', 'err', 'warn-soft', 'warn-line',
  'add-bg', 'del-bg', 'code-bg',
  'focus', 'shadow',
] as const;

/** The token rules of the given skins: light, dark by the system, dark by choice. */
export function tokensCss(skins: Skin[]): string {
  const block = (p: Palette, i: 0 | 1) => TOKENS.map((k) => `--${k}: ${p[k][i]};`).join(' ');
  const out: string[] = [
    ':root { color-scheme: light; }',
    ':root[data-theme="dark"] { color-scheme: dark; }',
    '@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; } }',
  ];
  for (const s of skins) {
    out.push(`.${s.cls} { ${block(s.palette, 0)} }`);
    out.push(`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]).${s.cls} { ${block(s.palette, 1)} } }`);
    out.push(`:root[data-theme="dark"].${s.cls} { ${block(s.palette, 1)} }`);
  }
  return out.join('\n');
}
