# Changelog

## [v1.0.3] - 2026-06-15

### Fixed

- Improve PDF attachment preview reliability by serving temporary preview files through the Wails asset server instead of embedding PDFs as base64 data URLs.
- Mark password-protected PDF attachments in the preview dialog and keep a direct save action available for system PDF readers.
- Stream attachment downloads through temporary files before replacing the selected target file, reducing memory use and preserving existing files if a download fails.

## [v1.0.2] - 2026-06-14

### Fixed

- Refine left sidebar scrolling so domain and mailbox account lists scroll independently inside their own sections.

## [v1.0.1] - 2026-06-14

### Fixed

- Make the left sidebar resource area scrollable when there are many domains or mailbox accounts.

## [v1.0.0] - 2026-06-14

Initial Windows desktop release for OmniMail Worker deployments.

### Added

- Manage multiple OmniMail endpoint profiles by base URL.
- Replace the default Wails icon with an OmniMail Desktop application icon.
- Test endpoint health and authentication status.
- Login or first-time setup with an admin account.
- Register and store desktop device tokens with Windows DPAPI protection.
- Load domains, mailboxes, messages, account settings, devices, diagnostics, and audit data from the selected endpoint.
- Install with a Windows setup wizard that supports English and Simplified Chinese.
- Choose the application install location and OmniMail data storage location during setup.
- Preserve the selected data folder and support in-place overwrite installs for future updates.
- Build the Windows installer with GitHub Actions and attach it to GitHub Releases.
