#!/usr/bin/env node
// Renders slides/diagrams/*.dot to slides/diagrams/*.svg using @hpcc-js/wasm
// (a pure-WebAssembly build of Graphviz, no system install required).
//
// Usage: node slides/render-diagrams.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Graphviz } from '@hpcc-js/wasm';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'diagrams');

const theme = {
  bg: 'transparent',
  fg: '#e8e8e8',
  cluster_host: { fill: '#1a2333', stroke: '#4f8cff', font: '#4f8cff' },
  cluster_kernel: { fill: '#2a2418', stroke: '#f5a623', font: '#f5a623' },
  cluster_apps: { fill: '#15301f', stroke: '#3ecf8e', font: '#3ecf8e' },
  node_blue:   { fill: '#1a2333', stroke: '#4f8cff', font: '#e8e8e8' },
  node_amber:  { fill: '#2a2418', stroke: '#f5a623', font: '#e8e8e8' },
  node_green:  { fill: '#15301f', stroke: '#3ecf8e', font: '#e8e8e8' },
  node_rose:   { fill: '#2a1a1f', stroke: '#ff5d8f', font: '#e8e8e8' },
  node_mute:   { fill: '#1a1a1a', stroke: '#9aa0a6', font: '#e8e8e8' },
  edge:        { stroke: '#9aa0a6', font: '#9aa0a6' },
};

function restyle(dot) {
  // Inject global attrs (fontcolor, bgcolor, edge color) at the top of the graph.
  // The dot sources already carry per-cluster and per-node colors, so this
  // is a defensive pass: we don't strip the existing colors, we only add
  // defaults for elements that don't override.
  const defaults = [
    '  bgcolor="transparent";',
    '  fontname="Helvetica";',
    '  fontcolor="#e8e8e8";',
    '  pad="0.4";',
    '  ranksep="0.55";',
    '  nodesep="0.35";',
  ].join('\n');
  return dot.replace(/^(\s*(?:digraph|graph)\s+\w+\s*\{)/m, '$1\n' + defaults);
}

async function main() {
  const gv = await Graphviz.load();
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.dot')).sort();
  if (!files.length) {
    console.error('No .dot files found in', dir);
    process.exit(1);
  }
  for (const f of files) {
    const inPath = path.join(dir, f);
    const outPath = path.join(dir, f.replace(/\.dot$/, '.svg'));
    const dot = await fs.readFile(inPath, 'utf8');
    const svg = gv.layout(dot, 'svg', 'dot');
    // Force background to transparent (some versions wrap a white rect).
    const cleaned = svg.replace(/<rect[^>]*fill="white"[^>]*\/>/g, '');
    await fs.writeFile(outPath, cleaned, 'utf8');
    const { size } = await fs.stat(outPath);
    console.log(`✓ ${f.padEnd(28)} → ${path.basename(outPath)} (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`\n${files.length} diagram(s) rendered to ${dir}`);
}

main().catch((e) => {
  console.error('Render failed:', e);
  process.exit(1);
});
