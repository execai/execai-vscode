// The stylesheet of the `execai ui` window: tokens, the shared structure,
// then one file per skin. The skins never touch each other's rules — each
// hangs on its own class on <html> — so three people can work on three files
// at once.

import { BASE_CSS, BASE_LAST_CSS } from './base';
import { BESEDA } from './beseda';
import { TELETYPE } from './teletype';
import { Skin, tokensCss } from './tokens';
import { VERSTAK } from './verstak';

/** In the order the picker shows them; the first one is the default. */
export const SKINS: Skin[] = [VERSTAK, BESEDA, TELETYPE];
export const DEFAULT_SKIN = VERSTAK.id;

export function windowCss(): string {
  return [tokensCss(SKINS), BASE_CSS, ...SKINS.map((s) => s.css), BASE_LAST_CSS].join('\n');
}
