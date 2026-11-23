// Runs on linkedin.com and serves the LinkedIn bridge (lib/linkedin): reading
// profiles through the viewer's own session. No feature logic lives here.
//
// Matches all of linkedin.com, not just /in/*, because LinkedIn is a
// single-page app and navigates without reloading.

import { serveLinkedIn } from '@/lib/linkedin/serve';

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    serveLinkedIn();
  },
});
