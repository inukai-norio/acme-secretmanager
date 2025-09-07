#!/usr/bin/env node

import { build } from 'esbuild';
import minimist from 'minimist';

(async () => {
  const args = minimist(process.argv.slice(2), {
    boolean: ['bundle', 'coverage'],
    default: { bundle: false, coverage: false },
  });
  const entry = args.entry;
  const outfile = args.outfile;
  const bundle = args.bundle;
  const coverage = args.coverage;

  if (!entry || !outfile) {
    console.error('Usage: node esbuild.js --entry=SRC --outfile=DEST [--bundle] [--coverage]');
    process.exit(1);
  }

  try {
    await build({
      entryPoints: [entry],
      outfile,
      bundle,
      platform: 'node',
      format: 'esm',
      target: 'es2024',
      sourcemap: coverage ? 'inline' : false,
      sourcesContent: coverage,
    });
  }
  catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
