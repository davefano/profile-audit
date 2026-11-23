import { defineConfig } from 'wxt';

export default defineConfig({
  zip: { artifactTemplate: 'profile-audit-{{version}}-{{browser}}.zip', sourcesTemplate: 'profile-audit-{{version}}-sources.zip' },
  manifest: ({ browser }) => ({
    name: 'Profile Audit',
    description: 'Checks a LinkedIn profile against clear rules and suggests what to improve, in a side panel.',
    permissions: ['storage', 'activeTab', 'scripting'],
    // www.linkedin.com: the content script reads the profile with your own session.
    host_permissions: ['https://*.linkedin.com/*'],
    action: { default_title: 'Toggle Profile Audit side panel' },
    commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+P' }, description: 'Toggle the side panel' } },
    ...(browser === 'firefox' && {
      // TODO: replace with the real add-on ID before submitting to AMO.
      browser_specific_settings: { gecko: { id: 'profile-audit@example.org' } },
    }),
  }),
});
