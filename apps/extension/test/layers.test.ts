// lib/linkedin is the extension's reusable LinkedIn bridge: it may use the
// LinkedIn data layer and the generic runtime, and nothing feature-specific.
import { expect, test } from 'bun:test';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { imports, sourceFiles } from '@profile-audit/core/test/source-files';

const DIR = join(import.meta.dir, '../lib/linkedin');
const PACKAGES = [/^@profile-audit\/core\/linkedin$/, /^@\/lib\/runtime$/];

test('lib/linkedin imports only the LinkedIn layer, the runtime, and itself', () => {
  const offenders = sourceFiles(DIR).flatMap((f) =>
    imports(f)
      // Relative imports must stay inside lib/linkedin; packages must be on the list.
      .filter((spec) => (spec.startsWith('.') ? !resolve(dirname(f), spec).startsWith(DIR + sep) : !PACKAGES.some((re) => re.test(spec))))
      .map((spec) => `${relative(DIR, f)} -> ${spec}`),
  );
  expect(offenders).toEqual([]);
});
