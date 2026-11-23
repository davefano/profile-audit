// The LinkedIn data layer must stay reusable: it may not depend on the audit
// or anything outside itself. The audit may read LinkedIn facts types but never fetch.
import { describe, expect, test } from 'bun:test';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { imports, sourceFiles } from './source-files';

const SRC = join(import.meta.dir, '../src');

/** Imports in `dir` that leave it, except to `allowed` modules. Packages always count as leaving. */
function leaving(dir: string, allowed: string[] = []) {
  return sourceFiles(dir).flatMap((f) =>
    imports(f)
      .filter((spec) => {
        if (!spec.startsWith('.')) return true;
        const target = resolve(dirname(f), spec);
        return !target.startsWith(dir + sep) && !allowed.includes(target);
      })
      .map((spec) => `${relative(SRC, f)} -> ${spec}`),
  );
}

describe('layers', () => {
  test('src/linkedin imports nothing outside itself', () => {
    expect(leaving(join(SRC, 'linkedin'))).toEqual([]);
  });

  test('src/audit imports only its own files and the profile facts types (never a reader)', () => {
    // The barrel re-exports readers, so it isn't allowed.
    expect(leaving(join(SRC, 'audit'), [join(SRC, 'linkedin/profile/facts')])).toEqual([]);
  });
});
