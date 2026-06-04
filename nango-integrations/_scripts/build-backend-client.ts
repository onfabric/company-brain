import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

// Keep the runtime/ambient packages as bare imports: `nango` is provided by the
// sandbox, `elysia`/`bun` only appear in the emitted .d.ts (and are resolvable when
// type-checking the syncs). Everything else — including the backend's App type — is
// bundled/inlined so the output is self-contained.
const KEEP_EXTERNAL = [
  /^nango$/,
  /^elysia(\/|$)/,
  /^bun$/,
  /^node:/,
  /^@sinclair\//,
  /^@elysiajs\//,
];

console.log('Building backend client...');

const bundle = await rolldown({
  input: '_backend-client/client.ts',
  external: KEEP_EXTERNAL,
  plugins: [...dts({ tsconfig: 'tsconfig.backend-client.json', resolver: 'tsc' })],
});

const outDir = 'syncs/brain-backend';
const { output } = await bundle.write({ dir: outDir, format: 'esm' });
await bundle.close();

console.log(
  `Built ${output.length} file(s) into ${outDir}: ${output.map((file) => file.fileName).join(', ')}`,
);
