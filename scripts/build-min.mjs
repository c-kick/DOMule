/**
 * build-min.mjs — Minify all .mjs sources and rewrite import paths to .min.mjs
 *
 * Usage: node scripts/build-min.mjs
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = [ROOT, join(ROOT, 'modules')];

const EXCLUDE = new Set(['vitest.config.mjs']);

async function discoverSources() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    let entries;
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.mjs')) continue;
      if (entry.endsWith('.min.mjs')) continue;
      if (EXCLUDE.has(entry)) continue;
      const full = join(dir, entry);
      const s = await stat(full);
      if (s.isFile()) files.push(full);
    }
  }
  return files;
}

/**
 * Rewrite relative import specifiers from .mjs to .min.mjs (idempotent).
 * Handles both static `from "..."` and dynamic `import("...")` forms.
 * Only rewrites relative paths (starting with ./ or ../), not bare specifiers or URLs.
 */
function rewriteImports(code) {
  // Static imports: from"./core.log.mjs" → from"./core.log.min.mjs"
  code = code.replace(
    /(from\s*["'])(\.\.?\/[^"']*?)(?:\.min)*\.mjs(["'])/g,
    '$1$2.min.mjs$3'
  );
  // Dynamic imports: import("./modules/hnl.breakpoints.mjs") → import("./modules/hnl.breakpoints.min.mjs")
  code = code.replace(
    /(import\s*\(\s*["'])(\.\.?\/[^"']*?)(?:\.min)*\.mjs(["']\s*\))/g,
    '$1$2.min.mjs$3'
  );
  return code;
}

async function build() {
  const sources = await discoverSources();
  if (sources.length === 0) {
    console.error('No source files found.');
    process.exit(1);
  }

  let totalOriginal = 0;
  let totalMinified = 0;
  let count = 0;

  for (const file of sources) {
    const code = await readFile(file, 'utf8');
    const result = await minify(code, {
      module: true,
      compress: { passes: 2 },
      format: { comments: false },
    });

    if (!result.code && result.code !== '') {
      console.error(`  SKIP ${relative(ROOT, file)} — terser returned no output`);
      continue;
    }

    const minified = rewriteImports(result.code);
    const outPath = file.replace(/\.mjs$/, '.min.mjs');
    await writeFile(outPath, minified, 'utf8');

    const origSize = Buffer.byteLength(code, 'utf8');
    const minSize = Buffer.byteLength(minified, 'utf8');
    totalOriginal += origSize;
    totalMinified += minSize;
    count++;

    const pct = origSize > 0 ? ((1 - minSize / origSize) * 100).toFixed(1) : '0.0';
    console.log(`  ${relative(ROOT, outPath)}  ${origSize} → ${minSize} bytes  (−${pct}%)`);
  }

  console.log('');
  console.log(`Done. ${count} file(s) minified.`);
  const totalPct = totalOriginal > 0 ? ((1 - totalMinified / totalOriginal) * 100).toFixed(1) : '0.0';
  console.log(`Total: ${totalOriginal} → ${totalMinified} bytes  (−${totalPct}%)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
