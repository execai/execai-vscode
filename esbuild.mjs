// Сборка расширения: один файл dist/extension.js (CJS — так грузит extension host).
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'], // модуль редактора, в бандл не входит
  sourcemap: true,
  minify: !watch,
});
if (watch) await ctx.watch();
else { await ctx.rebuild(); await ctx.dispose(); }
