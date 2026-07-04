# OmniMail Desktop

Windows desktop client for OmniMail Worker deployments.

## Scope

- Manage multiple OmniMail endpoints by base URL.
- Test `/api/health` and `/api/v1/auth/status`.
- Login or first-time setup with an admin account, then register a desktop device token.
- Store profile metadata locally and protect device tokens with Windows DPAPI.
- Load domains, mailboxes, and messages through the selected endpoint.
- Review a workspace overview with mailbox metrics, priority messages, recent mail, and common actions.
- Inspect endpoint activity with diagnostics, deployment progress, recent mailbox activity, and audit logs.
- Browse current-mailbox attachments from a dedicated center with metrics, type filters, search, sorting, preview, download, and jump-to-message actions.
- Install desktop updates with global update notifications, update badges, release notes, automatic-check preferences, remind-later and skip-version controls, download progress, cancel support, SHA256 verification, and verified installer cache reuse.
- Inspect local app information, recent application logs, update cache usage, and clear update or preview caches from the settings page.

Each profile maps to one deployed OmniMail Worker base URL. One profile can still expose many mail domains through the OmniMail API.

## Development

Requires Go 1.26.4 or newer, Wails, and Node.js 20.19 or newer.

```bash
wails dev
```

Run the local quality checks before committing:

```bash
powershell -ExecutionPolicy Bypass -File ./scripts/check-go.ps1 -Command test
powershell -ExecutionPolicy Bypass -File ./scripts/check-go.ps1 -Command vet
cd frontend
npm run check
npm test
npm run build
npm run smoke
```

## Build

```bash
wails build
```

The Windows executable is written to:

```text
build/bin/OmniMailDesktop.exe
```

The Windows installer is built with Inno Setup from:

```text
build/windows/OmniMailDesktop.iss
```

The installer supports English and Simplified Chinese, custom install location, custom data storage location, and in-place updates that preserve user data. The app checks GitHub Releases on startup, prefers the release `update-manifest.json` when available, keeps update state visible in the workspace, can defer or skip optional versions, downloads the newer installer with progress and cancellation, verifies the manifest SHA256 or `.sha256` checksum, reuses a verified cached installer when possible, asks before launching the installer, and quits the running app so the update can replace files cleanly.

## Release

Releases are published by GitHub Actions when a `v*` tag is pushed.

Before tagging a release:

1. Update `wails.json` `info.productVersion`.
2. Add the matching entry to `CHANGELOG.md`.
3. Commit the release changes.
4. Create and push the matching tag.

For example:

```bash
git tag v1.0.13
git push origin main
git push origin v1.0.13
```

The tag version and `wails.json` `productVersion` must match. CI enforces that match and checks that `CHANGELOG.md` contains the matching release section.

The workflow builds `build/bin/OmniMailDesktop.exe`, builds `build/installer/OmniMailDesktop-Setup-*.exe`, generates a SHA256 checksum and `build/installer/update-manifest.json`, validates the manifest against the installer and checksum, and attaches the installer, checksum, and update manifest to the GitHub Release. Release notes are extracted from the matching `CHANGELOG.md` section. After publishing, CI verifies the GitHub Release contains the installer, checksum, SBOM, and update manifest, and that the published manifest matches the installer asset.

Release builds also generate a CycloneDX SBOM at `build/installer/OmniMailDesktop-Setup-*.sbom.json` and attach it to the GitHub Release.

Code signing is optional. To enable it in GitHub Actions, add these repository settings:

- Secret `WINDOWS_SIGNING_CERT_BASE64`: base64-encoded `.pfx` certificate.
- Secret `WINDOWS_SIGNING_CERT_PASSWORD`: certificate password, if required.
- Variable `WINDOWS_SIGNING_TIMESTAMP_URL`: timestamp server URL. If omitted, the workflow uses DigiCert's timestamp server.

When the signing certificate secret is not present, the release workflow skips signing and still builds the installer, checksum, and SBOM.

## Local Data

Profiles are stored in the user config directory under `OmniMailDesktop/profiles.json`.
If that directory is not writable during local development, the app falls back to `.omnimail-desktop/profiles.json` in the project directory.
The app also writes a small local JSONL log next to `profiles.json` as `omnimail-desktop.log`. The workspace settings page can export a diagnostic package that includes the redacted endpoint report and recent local log lines.
