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
wails build -tags native_webview2loader
```

The Windows executable is written to:

```text
build/bin/OmniMailDesktop.exe
```

## Local Data

Profiles are stored in the user config directory under `OmniMailDesktop/profiles.json`.
If that directory is not writable during local development, the app falls back to `.omnimail-desktop/profiles.json` in the project directory.
