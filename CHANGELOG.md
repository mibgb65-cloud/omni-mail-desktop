# Changelog

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
