# Rust account settings and credential storage

Status: N03a implementation under review. Saved settings are **unverified**; the Rust app does not yet connect to providers.

## Boundaries and recovery

- All email, endpoint, username and password fields live in per-account OS credential entries. A separate OS-protected index contains only random UUIDv4 identifiers, version 1. Service namespace: `com.mademailclient.rust.accounts.v1`; index key: `registry-v1`. No credentials or settings are written to application JSON files, logs or diagnostic errors.
- Explicit backend selection: Mac legacy Keychain; Windows Credential Manager with Local persistence; Linux Secret Service with Rust crypto for the D-Bus secret exchange. Never select the library's mock/default store in production. Linux needs a running, unlocked Secret Service; there is no file/session fallback on failure.
- A background worker serializes this window's operations. An OS file lock serializes account-index changes across processes. Only an empty lock file is kept in `$HOME/.made-mail-rust-evaluation/accounts.lock` (Mac/Linux) or `%LOCALAPPDATA%/.made-mail-rust-evaluation/accounts.lock` (Windows). No Electron profile is opened. Failure to acquire the lock refuses the operation.
- Index references are reserved **before** account entries are written. Missing/corrupt account entries appear as Incomplete and can be removed. A failed save never leaves an unreferenced secret. Removal deletes the entry before removing the index reference, so an interrupted index update also remains discoverable/removable. Credential-store operations are not a multi-entry transaction: after an uncertain result, Reload before retrying.
- Locked/unreadable index storage is never treated as empty. Invalid/duplicate/noncanonical identifiers, wrong index version and oversized indexes fail closed. Removal is allowed only for a valid identifier in this application's index. No enumeration of unrelated credentials is performed.
- Maximum 32 saved settings entries; maximum 2,300 serialized bytes per account/index, bounded before writes. Each password is at most 1,024 bytes, but the combined serialized record must also fit. This keeps records below the Windows credential blob limit. Password fields are masked and cleared when the form is saved/closed; owned password strings and serialization/read buffers are zeroized on drop. This is not a guarantee that all copies inside GUI/OS/library internals are erased immediately.
- Endpoint validation checks syntax, field bounds, control characters, nonzero ports and explicit TLS/STARTTLS enum values. It does not authenticate or discover servers, perform DNS/SSRF checks or validate certificates yet, because this slice opens no network connections. Those checks are mandatory before N04 connects these settings.
- The dialog lists only account labels/status/IDs; it never loads saved passwords into the form. It marks entries Unverified, not Connected. Removing settings does not delete remote mail. Existing Electron accounts are untouched.

## Tests and evidence

Synthetic tests cover account isolation, add/reload/remove, interrupted save/removal recovery, missing/corrupt/locked storage, invalid endpoints, payload limits and exclusive operation locking. GUI acceptance uses `--account-fixture`, whose conspicuous banner and save button identify temporary in-memory settings. Normal CI never touches native credentials. An explicit ignored Mac test writes/reads/deletes one unique `com.mademailclient.synthetic-check.<uuid>` entry; no credential enumeration or personal profile access occurs. The Mac roundtrip passed locally. Windows/Linux native-store restart acceptance remains pending.

## Dependency review

Direct additions, pinned with Cargo.lock: keyring-core 1.0.1; apple-native-keyring-store 1.0.2 (`keychain`, Mac only); windows-native-keyring-store 1.1.0 (Windows only); dbus-secret-service-keyring-store 1.0.1 (`crypto-rust`, Linux only); serde 1.0.229 and serde_json 1.0.154 for strict bounded schema decoding; uuid 1.29.2 (`v4`) for OS-random identifiers; zeroize 1.9.1 for owned secret buffers. Their package manifests declare MIT OR Apache-2.0 (or the equivalent order). No provider SDK or Mailcraft code is incorporated.

Linux dynamically links the system D-Bus library; `libdbus-1-dev` is a CI/build prerequisite. Vendored D-Bus/OpenSSL features are disabled. Preserve transitive dependency licenses when packaging; this review does not replace a release-time vulnerability/license audit.

Official APIs consulted:
- https://docs.rs/keyring-core/1.0.1/keyring_core/
- https://docs.rs/apple-native-keyring-store/1.0.2/apple_native_keyring_store/
- https://docs.rs/windows-native-keyring-store/1.1.0/windows_native_keyring_store/
- https://docs.rs/dbus-secret-service-keyring-store/1.0.1/dbus_secret_service_keyring_store/
