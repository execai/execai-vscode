// Colour tokens of the `execai ui` window.
//
// A skin names its colours once, as [light, dark] pairs; everything it draws
// refers to them by token (var(--bg), var(--accent)…), never by value. <html>
// carries data-theme="light" | "dark" (set before the first paint, see
// headScript in window/markup.ts): dark until the person picks a theme, then
// what was picked. "As the system" is a choice too: the attribute is absent
// and the system setting decides.
//
// PREVIEW is the class of a small picture of a skin (the look picker): an
// element with it and a skin's class has that skin's tokens, in the theme the
// window is in — whatever skin the window itself wears.

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

export const PREVIEW = 'pk-pv';

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
    out.push(`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .${PREVIEW}.${s.cls} { ${block(s.palette, 1)} } }`);
    out.push(`:root[data-theme="dark"] .${PREVIEW}.${s.cls} { ${block(s.palette, 1)} }`);
  }
  return out.join('\n');
}
