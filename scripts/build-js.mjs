#!/usr/bin/env node
/**
 * perf-fix directive Fix 3 — every page that touches auth (directly or via
 * app/shell.js) imports auth/client.js, which used to import
 * @supabase/supabase-js from esm.sh at runtime (a 10+ request chain, ~1.2s
 * critical path, on literally every page site-wide since content-shell.js's
 * shared header loads auth/nav.js). Now that auth/client.js imports the real
 * npm package, every one of these needs to be pre-bundled — browsers can't
 * resolve a bare `@supabase/supabase-js` specifier on their own.
 *
 * Run with `npm run build-js`. Re-run after editing any file these entries
 * import (directly or transitively) — output is committed, not built by Vercel.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'js'), { recursive: true });

// Every module here imports its siblings with root-absolute paths
// (`/auth/client.js`) since that's how they're served in-browser — esbuild
// otherwise treats a leading `/` as filesystem-absolute. Resolve those
// against the repo root instead.
const rootAbsolutePlugin = {
  name: 'root-absolute',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\// }, (args) => {
      if (args.kind === 'entry-point') return null; // esbuild already gives these as real absolute fs paths
      return { path: join(ROOT, args.path) };
    });
  },
};

const ENTRIES = {
  'nav': 'auth/nav.js',
  'form': 'auth/form.js',
  'callback': 'auth/callback.js',
  'verify-banner': 'auth/verify-banner.js',
  'calculator': 'calculator/calculator.js',
  'app': 'app/app.js',
  'app-new': 'app/new/new.js',
  'app-admin': 'app/admin/admin.js',
  'app-admin-carousel': 'app/admin/carousel/carousel.js',
  'app-admin-responder': 'app/admin/responder/responder.js',
  'chat-widget': 'chat-widget/chat-widget.js',
  'app-estimate': 'app/estimate/estimate.js',
  'demo': 'demo/demo.js',
};

for (const [name, entry] of Object.entries(ENTRIES)) {
  await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: join(ROOT, 'js', `${name}.bundle.js`),
    target: 'es2022', // auth/callback.js uses top-level await
    logLevel: 'warning',
    plugins: [rootAbsolutePlugin],
  });
  console.log(`  wrote js/${name}.bundle.js (from ${entry})`);
}
console.log(`\nBuilt ${Object.keys(ENTRIES).length} bundle(s).`);
