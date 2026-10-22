# Security and privacy design (required before real accounts)

- Threat boundaries: hostile mail HTML/attachments; browser sessions; cross-account access; provider OAuth credentials; worker retries; third-party operators.
- Use OAuth authorization code with PKCE where supported, state binding, minimal scopes and server-side credential exchange. Define session expiration, revocation and CSRF protection before account linking.
- Encrypt tokens and sensitive cached content with managed keys separate from the database. Never expose refresh tokens to the UI or logs. Self-hosting needs documented key creation, rotation and backup.
- Enforce tenant/account ownership on every read, search, folder mutation and worker action. Test attempts to access another user's IDs.
- Sanitize HTML with a maintained allowlist sanitizer; isolate rendering and block remote images by default. Treat attachments as untrusted downloads. The prototype renders only text.
- Auto replies: detect Auto-Submitted and relevant suppression/list headers, self-sent mail, bounces, and automated senders. Persist per-account/sender cooldowns and idempotency records. The current helper demonstrates only policy inputs; it does not parse headers or persist state.
- Permanent deletion: explicit rule-builder opt-in, provider capability checks, preview and audit record. Do not convert failed moves into deletion.
- Logs contain IDs and outcomes, not bodies, tokens or response templates. Define retention, disconnect cleanup, data export and deletion before hosted beta.
- Tests and screenshots use fictional accounts only. Complete security review and recovery exercises before handling real mail.
