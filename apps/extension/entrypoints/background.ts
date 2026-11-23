// Background: the toolbar toggle. The audit itself runs in the panel.

import { setUpToolbarToggle } from '@/lib/toolbar';

// Non-persistent on MV2 (Firefox/Safari) to match the Chrome service worker.
export default defineBackground({
  persistent: false,
  main() {
    setUpToolbarToggle();
  },
});
