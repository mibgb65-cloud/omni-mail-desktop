# OmniMail Desktop

Windows desktop client for OmniMail Worker deployments.

## Scope

- Manage multiple OmniMail endpoints by base URL.
- Test `/api/health` and `/api/v1/auth/status`.
- Login or first-time setup with an admin account, then register a desktop device token.
- Store profile metadata locally and protect device tokens with Windows DPAPI.
- Load domains, mailboxes, and messages through the selected endpoint.

Each profile maps to one deployed OmniMail Worker base URL. One profile can still expose many mail domains through the OmniMail API.

## Development

```bash
wails dev
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

The installer supports English and Simplified Chinese, custom install location, custom data storage location, and in-place updates that preserve user data.

## Release

Releases are published by GitHub Actions when a `v*` tag is pushed.

Before tagging a release:

1. Update `wails.json` `info.productVersion`.
2. Add the matching entry to `CHANGELOG.md`.
3. Commit the release changes.
4. Create and push the matching tag.

For example:

```bash
git tag v1.0.4
git push origin main
git push origin v1.0.4
```

The tag version and `wails.json` `productVersion` should match. The workflow builds `build/bin/OmniMailDesktop.exe`, builds `build/installer/OmniMailDesktop-Setup-*.exe`, and attaches the installer to the GitHub Release.

## Local Data

Profiles are stored in the user config directory under `OmniMailDesktop/profiles.json`.
If that directory is not writable during local development, the app falls back to `.omnimail-desktop/profiles.json` in the project directory.
