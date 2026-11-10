// The QR code of the phone link (E105), drawn in the panel with no request
// anywhere: the encoder (uqr, MIT, a port of Project Nayuki's generator) is
// bundled, and the panel gets one SVG path.
//
// Like protocol.ts, this module depends on neither vscode nor node: PanelCore
// runs it in the extension and in the browser page of `execai ui`.

import { encode } from 'uqr';

/** A QR code as a size×size grid (the quiet zone included) and one SVG path of its dark modules. */
export interface QrPicture {
  size: number;
  path: string;
}

/**
 * The modules of a QR code, true for dark, with a light border of `border`
 * modules all round. Error correction M: a phone camera reads it off a
 * screen at an angle, and a link of this length still fits a small version.
 */
export function qrMatrix(text: string, border = 2): boolean[][] {
  const qr = encode(text, { ecc: 'M', border: 0 });
  const n = qr.size + 2 * border;
  const out: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) {
      const qx = x - border, qy = y - border;
      row.push(qx >= 0 && qy >= 0 && qx < qr.size && qy < qr.size && !!qr.data[qy][qx]);
    }
    out.push(row);
  }
  return out;
}

/**
 * The QR code of a text as one SVG path: every horizontal run of dark
 * modules is a 1-high rectangle. Null for an empty text or one that does not
 * fit a QR code at all.
 */
export function qrPicture(text: string, border = 2): QrPicture | null {
  if (!text) return null;
  let m: boolean[][];
  try {
    m = qrMatrix(text, border);
  } catch {
    return null; // longer than the largest version holds
  }
  let path = '';
  for (let y = 0; y < m.length; y++) {
    let x = 0;
    while (x < m.length) {
      if (!m[y][x]) { x++; continue; }
      let w = 1;
      while (x + w < m.length && m[y][x + w]) w++;
      path += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return { size: m.length, path };
}
