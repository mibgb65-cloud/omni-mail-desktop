# Changelog

## [Unreleased]

## [v1.0.14] - 2026-07-04

### Added

- Add a mailbox operation queue for batching read/unread, star/unstar, archive, and restore actions against visible message sets.
- Persist mailbox operation queues per endpoint, domain, and account so pending work can recover after leaving the page.
- Add a current-mailbox search center with keyword search, status filters, relevance/time sorting, load-more support, and jump-to-message actions.
- Add opt-in search expansion across the selected endpoint's loaded domains, accounts, sender/account metadata, and recent messages.
- Add message search helpers and tests for field matching, filters, sorting, and summary counts.
- Add a current-mailbox contact center with contact aggregation, search, filters, sorting, copy-email, compose, and jump-to-message actions.
- Add contact aggregation helpers and tests for participant normalization, counts, filters, and sorting.
- Add a local privacy status panel for token protection, preview cache, update cache, and recent local log exposure.

### Changed

- Extract the mailbox list, reader, and composer workspace into a dedicated component to keep `App.jsx` below the line limit as more workspace pages are added.
- Extract account and domain management pages into a dedicated component module to keep editor pages focused.
- Split shared overlay, skeleton, empty-state, and responsive CSS into a separate style module to keep style files below the line limit.
- Route compose actions from workspace pages back to the mailbox composer so contact prefill and dashboard compose actions open the expected view.
- Expand the frontend smoke check to verify production UI routes and styles are present in built assets.

## [v1.0.13] - 2026-07-04

### Added

- Add a left-sidebar attachment center for the current mailbox with attachment metrics, type filters, search, sorting, preview, download, and jump-to-message actions.
- Add attachment aggregation helpers and frontend tests for attachment filtering, sorting, and summary counts.

## [v1.0.12] - 2026-07-04

### Added

- Add release manifest validation in CI and a post-publish release asset check for installer, checksum, SBOM, and manifest consistency.
- Add settings controls for automatic update checks and remind-later interval preferences.
- Add settings panels for app version, local storage paths, update cache usage, active attachment previews, cache cleanup, and recent local logs.
- Add frontend tests for update reminder and skip-version preferences.

### Changed

- Expose local app info, recent application logs, update cache info, update cache cleanup, and attachment preview cache cleanup through desktop APIs.

## [v1.0.11] - 2026-07-04

### Added

- Add a release `update-manifest.json` asset with installer URL, size, SHA256, channel, minimum version policy, and release notes for in-app updates.
- Add in-app update deferral controls for "remind later", "skip this version", and restoring update reminders.
- Show update package size and release-note summary in the settings page.

### Changed

- Prefer manifest SHA256 metadata for installer verification while keeping `.sha256` assets as a fallback.
- Clean old cached update installers after a verified download or cache reuse.
- Ask for confirmation before launching the installer and quitting the app.

## [v1.0.10] - 2026-07-04

### Added

- Add global update state with left-sidebar update badges, shared settings-page update status, download progress, cancel support, retry flow, and verified installer cache reuse.

## [v1.0.9] - 2026-07-04

### Added

- Add left-sidebar workspace overview and activity center pages with mailbox metrics, priority mail, recent messages, endpoint diagnostics, and audit logs.

## [v1.0.8] - 2026-07-04

### Added

- Add a visible left-sidebar workspace settings entry on both the endpoint picker and mailbox views.

## [v1.0.7] - 2026-07-04

### Added

- Add one-click update installation from the settings page with release installer download, SHA256 verification, installer launch, and app exit.

### Changed

- Include installer asset and checksum metadata in update checks so the app can drive verified update installation instead of only opening the release page.

## [v1.0.6] - 2026-07-04

### Added

- Add an in-app GitHub Release update check with startup update notifications and a manual settings action.
- Add diagnostic package export with recent local application log lines.
- Add a frontend build smoke check to CI.
- Add optional Windows code signing hooks for release executables and installers.
- Add CycloneDX SBOM generation for Windows release assets.

### Changed

- Virtualize large mailbox lists to reduce render work when many messages are loaded.
- Improve left sidebar accessibility states for active folders, domains, accounts, endpoint cards, and endpoint menus.

## [v1.0.5] - 2026-07-04

### Added

- Add CI checks for release metadata, frontend linting, frontend unit tests, production npm audit, Go vet, Go vulnerability scanning, and installer SHA256 checksums.
- Add Dependabot update monitoring for npm, Go modules, and GitHub Actions.
- Add frontend unit tests for shared utility behavior and diagnostic report redaction.
- Add a settings action to copy a redacted diagnostic JSON report.
- Add a shared Go check script that excludes `frontend/node_modules` from package discovery.

### Changed

- Upgrade the Vite development toolchain to remove npm audit findings.
- Pin CI to Go 1.26.4 and Node.js 20.19.x for current security fixes and toolchain compatibility.
- Show compact whole-number attachment sizes such as `1 KB` instead of `1.0 KB`.
- Extract GitHub Release notes from the matching changelog version instead of publishing the full changelog.

### Fixed

- Fix missing frontend imports that could cause settings, resource manager, and sidebar menu views to fail at runtime.
- Preserve the correct return page when adding or editing endpoint profiles after the frontend action split.
- Add full hover titles for long endpoint and domain names in the left sidebar.

## [v1.0.4] - 2026-07-04

### Added

- Add built-in PDF.js attachment preview with password prompt, page navigation, and zoom controls.
- Add paged mailbox loading with a "load more" control in the desktop UI.
- Add CI enforcement to keep hand-written source files under 600 lines.

### Changed

- Render one PDF page at a time in the attachment preview to reduce memory use on large documents.
- Standardize desktop release builds on the default Wails WebView2 loader.
- Split large Go, React, and CSS files into focused modules.
- Serve image and PDF attachment previews through local preview URLs instead of base64 payloads.
- Write local profile storage atomically and reduce unnecessary `LastUsedAt` writes.
- Use `npm ci` for Wails frontend installs.

### Fixed

- Prevent protected tokens from silently falling back to plaintext when Windows DPAPI protection fails.
- Ignore stale mailbox and endpoint-health responses after the user switches context.
- Improve attachment filename sanitization for Unicode names and Windows reserved device names.

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
