import { expect, test } from 'bun:test';
import { profileSlugFromUrl } from '../src/linkedin/target';

test.each([
  ['https://www.linkedin.com/in/Jane-Doe/', 'Jane-Doe'],
  ['https://www.linkedin.com/in/jane-doe?trk=abc', 'jane-doe'],
  ['https://m.linkedin.com/in/jane-doe', 'jane-doe'],
  ['https://uk.linkedin.com/in/jane-doe', 'jane-doe'],
  ['https://www.linkedin.com/en/in/jane-doe/details/experience/', 'jane-doe'],
])('profile slug from %s', (input, slug) => {
  expect(profileSlugFromUrl(input)).toBe(slug);
});

test.each([
  [''],
  [null],
  ['https://example.com/in/jane'],
  ['https://evil-linkedin.com/in/jane'],
  ['https://www.linkedin.com/in/'],
  ['https://www.linkedin.com/feed/'],
  ['https://www.linkedin.com/company/example-co/'],
])('no profile slug for %p', (input) => {
  expect(profileSlugFromUrl(input)).toBeNull();
});
