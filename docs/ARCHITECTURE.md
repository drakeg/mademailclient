# Architecture

## Current implementation
A localhost Node static server serves a dependency-free web UI. Synthetic fixtures exist in browser memory. A shared ECMAScript module validates rules and emits action plans. Preview never executes actions. Rule ordering follows array order, exceptions override matches, and stop processing ends evaluation after a matching rule. Conditions use case-insensitive literal comparisons; there is no regex or expression evaluation. The UI exposes a subject-only subset of the core schema.

## Target architecture (proposed)
Shared web UI -> authenticated application API -> account-scoped provider adapters. Synchronization and rule execution run in durable workers. A relational store holds account metadata, folder maps, sync cursors, versioned rules, execution records and encrypted credential references. A desktop shell reuses UI and domain packages; Electron packaging is selected in ADR 0002 and serves bundled assets through an allowlisted custom protocol.

Provider adapters expose folder capabilities, message retrieval, incremental changes, send/reply, move, Junk, Trash and permanent deletion. Microsoft Graph, Gmail, and IMAP/SMTP support are separate delivery increments, not current capabilities. OAuth registration, scopes, consent and work-account policies must be verified against official provider documentation during implementation. iCloud authentication and IMAP support need a dedicated capability investigation.

A hosted service and self-hosted distribution share the backend contract. Each deployment must own its OAuth registrations, encryption keys, data retention policy and operators. Email providers remain responsible for email delivery and mailbox storage. Cached content in Made Mail requires explicit retention controls.

## Worker semantics
Use stable provider IDs and account IDs. Deduplicate change events. Persist an execution key comprising account, message, rule version and action index. Retry transient failures with bounded backoff and provider rate-limit awareness. Never retry an ambiguous send/delete blindly: reconcile provider state or require operator review. Different instances must coordinate through durable storage.

Preview uses a snapshot and reports planned actions; execution rechecks permissions and capabilities. Folder destinations are provider folder IDs, not display names. Provider-specific semantics must be visible to users; unsupported actions fail clearly.

## Desktop and offline
Mac/Windows desktop apps are the primary delivery track. Electron shell and DMG/NSIS build configurations are implemented; signing, installer acceptance, native credentials and updates remain pending. Define local encrypted cache and conflict rules before enabling offline mutations. Hosted rules continue when clients close; a closed standalone app cannot promise background execution.

## Decisions
See adr/0001-foundation.md. See adr/0002-desktop-first.md. Future decisions: identity/session design, database and queue, provider order, credentials/key management, and hosting distribution.
