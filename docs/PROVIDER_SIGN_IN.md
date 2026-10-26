# Provider sign-in implementation and registration

Goal: File → Add Account opens a provider chooser. Gmail/Yahoo browser sign-in opens the system browser, obtains provider consent, and stores refresh/access tokens in the existing OS-encrypted vault. Users never enter their normal provider password into Made Mail. Manual IMAP/SMTP remains available, with a simpler provider/app-password path.

## Publisher prerequisites (currently missing)

The repository owner confirmed on 2026-10-26 that no provider applications have been registered. Code and protocol tests cannot supply this registration or demonstrate a real provider login. Builds without registered client IDs must show browser sign-in as unavailable, with the app-password path still available.

Google requires a Desktop OAuth client, a consent screen and approved/test users for the requested mail scopes. Yahoo requires a public/native OAuth client with PKCE, the registered custom callback `com.mademailclient.auth://yahoo/callback`, and mail-scope access approval. Use the system browser; do not embed login pages, reuse another application's client ID, ship a confidential-client secret or bypass provider verification.

## Implementation contract

- Fixed provider endpoints and scopes; renderer supplies only provider selection, optional email hint and optional existing account ID.
- Authorization Code + PKCE S256, random state, exact callback matching, single use, cancellation and five-minute expiry.
- Google uses an ephemeral HTTP listener bound only to 127.0.0.1. Yahoo uses the registered custom app callback. Neither accepts arbitrary callback hosts or endpoints from the UI.
- Token exchanges and profile lookup use verified HTTPS with bounded response sizes, timeouts and no redirects. Provider userinfo supplies the account identity; never trust a decoded, unverified ID token or the typed email hint.
- Access/refresh tokens stay in the main process and encrypted vault. Refresh before expiry, preserve rotated refresh tokens atomically, and report reauthorization when refresh is denied. Never move tokens into renderer storage or logs.
- Account summaries omit tokens and OAuth client metadata. Reconnect must preserve the authorized account identity; no silent account replacement. Removal forgets local credentials; provider-side consent can be revoked in the provider's account security page.
- OAuth accounts use fixed provider hosts and cannot be repointed through manual settings. Gmail's IMAP scope is broad (`https://mail.google.com/`); make that permission visible. Yahoo requests read-only mail access initially; SMTP sending is not enabled.

## Sources reviewed

- [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app): public clients, loopback callback, PKCE, registration and token refresh.
- [Gmail XOAUTH2](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol): IMAP/SMTP require the full mail scope; provider verification applies.
- [Sign In With Yahoo](https://developer.yahoo.com/sign-in-with-yahoo/): public clients omit client secrets and require PKCE; native custom redirects are documented.
- [Yahoo mail developer documentation](https://senders.yahooinc.com/developer/documentation/): mail scopes require approval; mail-r is read access.

Provider registration/approval, actual browser consent, credential persistence across restarts, and installed-app callback registration remain live acceptance gates. Synthetic tests prove protocol boundaries, not provider approval.

## Register and configure a build

This is publisher work once for Made Mail, not a task for every email user:

1. In Google Cloud, create/select the Made Mail project, configure the OAuth consent screen and a Desktop app client, and allow the Gmail IMAP scope plus identity/email. Add designated test users while the app is in testing. Complete Google's applicable verification before public distribution. A Desktop client ID is public app metadata; do not substitute a Web/confidential client.
2. In Yahoo Developer Network, create a public/native client with PKCE, register `com.mademailclient.auth://yahoo/callback`, request identity/email and mail-r access, and complete the Yahoo Mail approval process. Confirm that Yahoo approves the exact native callback for this client. No client secret is bundled.
3. For source testing, set `MADEMAIL_GOOGLE_CLIENT_ID` or `MADEMAIL_YAHOO_CLIENT_ID` in the app's environment. Google uses an ephemeral loopback listener. Yahoo additionally needs the installed desktop app to own the registered custom protocol; source-only launch does not register that protocol silently.
4. For packaged GitHub builds, set repository Actions **variables** `GOOGLE_DESKTOP_CLIENT_ID` and `YAHOO_PUBLIC_CLIENT_ID`. The workflow writes these public IDs into `apps/desktop/oauth-clients.json` using `scripts/configure-oauth.mjs`. Empty variables produce a build explicitly marked unregistered; the build must never borrow a client ID or fabricate registration. Alternatively run `pnpm oauth:configure` with the environment variables before a local package build.
5. With disposable test accounts, verify consent denial/cancel, successful mail login, restart and token refresh, revoked consent, reconnect to the same identity, duplicate-account handling, and installed Yahoo callback dispatch on both operating systems. Keep all credentials and mail out of CI. Provider approval is separate from these synthetic checks.

The runtime validates tokens with the provider's HTTPS UserInfo endpoint and verifies the mailbox login before saving. Gmail SMTP login is also verified without sending. Yahoo uses mail-r and leaves outgoing mail unverified/disabled. Refresh-token rotation is written to the encrypted vault; expired/revoked authorization asks for reconnection. Disconnect removes local credentials; revoke the grant in Google/Yahoo's account security page if you also want to invalidate provider consent.

## Current end-user path

File → Add Account → Gmail or Yahoo Mail → Use an app password shows email address and app password, fills both servers/usernames and collapses advanced settings. iCloud has the same simplified app-password path. Other email exposes manual IMAP/SMTP and automatic server discovery. No normal Google/Yahoo password is collected. Browser sign-in is disabled with a publisher-registration explanation until the app is configured. OAuth account records expose Reconnect rather than allowing their token to be redirected through manual server editing.
