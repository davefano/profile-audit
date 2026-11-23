// Helpers for the layer tests (here and in apps/extension): source files and their imports.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : [],
  );
}

export function imports(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}
