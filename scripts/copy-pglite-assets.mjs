import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const destDir = join(
  process.cwd(),
  ".vercel/output/functions/__server.func/_libs",
);
const srcDir = join(process.cwd(), "node_modules/@electric-sql/pglite/dist");

if (!existsSync(destDir)) {
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const src = join(srcDir, name);
  if (existsSync(src)) copyFileSync(src, join(destDir, name));
}
