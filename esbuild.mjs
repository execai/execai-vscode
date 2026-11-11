// Builds the extension into one file, dist/extension.js (CJS — that is what the
// extension host loads).
//
// --panel builds the browser page of `execai ui` instead:
// dist/panel-browser.en.html and dist/panel-browser.ru.html — the window of
// `execai ui` (src/browserPage.ts) around the chat panel's script, with
// browserHost.ts inlined. The agent embeds them (scripts/sync-panel.sh in
// agent-vbai) and fills in {{NONCE}} and {{CONFIG}} when it serves the page.
import esbuild from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const watch = process.argv.includes('--watch');

if (process.argv.includes('--panel')) {
  await buildPanel();
} else {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['vscode'], // the editor's module, not part of the bundle
    sourcemap: true,
    minify: !watch,
  });
  if (watch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}

async function buildPanel() {
  // The host script, as the page inlines it.
  const host = await esbuild.build({
    entryPoints: ['src/browserHost.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    write: false,
  });
  const hostJs = host.outputFiles[0].text;

  // The page builder, minified like the release: functions injected into the
  // page through toString() have to survive it.
  const page = await esbuild.build({
    entryPoints: ['src/browserPage.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
    minify: true,
    write: false,
  });
  const dir = mkdtempSync(join(tmpdir(), 'execai-panel-'));
  try {
    const file = join(dir, 'browserPage.cjs');
    writeFileSync(file, page.outputFiles[0].text);
    const { browserHtml } = createRequire(import.meta.url)(file);
    mkdirSync('dist', { recursive: true });
    for (const lang of ['en', 'ru']) {
      const l10n = lang === 'en' ? {} : JSON.parse(readFileSync(`l10n/bundle.l10n.${lang}.json`, 'utf8'));
      const out = `dist/panel-browser.${lang}.html`;
      writeFileSync(out, browserHtml(lang, hostJs, l10n));
      console.log(out);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
