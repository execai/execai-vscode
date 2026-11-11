// The page `execai ui` serves: the panel script of the editor extension
// (webviewHtml.ts) inside the window of `execai ui` — its markup and draw
// functions (src/window) and its three skins (src/skins).
//
// Kept apart from webviewHtml.ts on purpose: the extension imports only
// chatHtml from there, so nothing of the window — stylesheets, markup, the
// window script — gets into the extension bundle. The panel build
// (esbuild.mjs --panel) and the tests take both pages from this module.

import { DEFAULT_SKIN, SKINS, windowCss } from './skins';
import { NONCE_SLOT, STRINGS, panelPage, pickLang } from './webviewHtml';
import { headScript, windowMarkup } from './window/markup';
import { WINDOW_JS } from './window/script';
import { WINDOW_STRINGS } from './window/strings';

export * from './webviewHtml';
export { SKINS, DEFAULT_SKIN } from './skins';
export { TOKENS } from './skins/tokens';
export { ICON_NAMES } from './window/markup';
export { WINDOW_JS } from './window/script';
export { WINDOW_STRINGS } from './window/strings';

/**
 * The chat page for a browser, as `execai ui` serves it
 * (dist/panel-browser.<lang>.html, built by `npm run build:panel`).
 *
 * hostJs is the bundled browserHost.ts; l10n is the translation table of the
 * extension host strings (l10n/bundle.l10n.<lang>.json), which PanelCore
 * needs in the page. The server replaces every {{NONCE}} with a fresh nonce
 * and {{CONFIG}} — a JavaScript literal inside the host script — with JSON
 * {lang, cwd, version, upload} (<, >, & and ' escaped as \u…).
 */
export function browserHtml(lang: string | undefined, hostJs: string, l10n: Record<string, string> = {}): string {
  const code = pickLang(lang);
  const strings = WINDOW_STRINGS[code];
  return panelPage(code, {
    nonce: NONCE_SLOT,
    browser: {
      hostJs,
      l10n,
      win: {
        css: windowCss(),
        markup: windowMarkup({ ...STRINGS[code], ...strings }),
        head: headScript(SKINS.map((s) => s.id), DEFAULT_SKIN),
        script: WINDOW_JS,
        strings,
      },
    },
  });
}
