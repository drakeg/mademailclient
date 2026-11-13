# Rust IMAP/SMTP sign-in verification

Status: implementation under review. This adds authentication checks, not receiving or sending mail.

In Accounts, choose **Test IMAP and SMTP…** for saved settings. The confirmation names the account, both server hostnames/ports and TLS modes. **Verify sign-in** explicitly authorizes sending those saved credentials to those servers, after TLS validation. Cancel performs no connection. Both services report independently; only joint success shows **Authentication checked this session**. This is a historical result, not a persistent connection or a write-permission guarantee.

## Network and protocol boundary

- Load credentials only for a valid UUID in this application's OS-protected index. Never accept an arbitrary credential key/path. Credentials stay in the background worker; the UI receives status and endpoint summaries only.
- Resolve the hostname once per endpoint, reject empty/oversized or mixed private/public answer sets, and connect to the checked IP directly. Use the original hostname for SNI/certificate verification. Private, loopback, link-local, multicast, documentation, mapped and transition addresses are refused; IPv6 support is conservatively restricted to global unicast. Private/VPN-only mail servers are not supported by this slice.
- DNS has a five-second wait and at most two outstanding resolver threads; timed-out resolvers never receive credentials. Try at most four checked addresses with bounded connect time. Socket reads/writes, including the TLS transport, share a 25-second endpoint deadline and five-second individual waits. Platform-native certificate/trust evaluation may impose additional OS latency; the UI remains responsive in its worker.
- Use native-tls with system trust, hostname verification, SNI and minimum TLS 1.2. No invalid-certificate/hostname flag, plaintext downgrade, custom production root or trust-setting change is available.
- Direct TLS validates before reading the protocol greeting. STARTTLS requires an advertised upgrade and positive response, refuses buffered data at the boundary, then validates TLS and requests fresh capabilities. No password is sent before that handshake succeeds.
- IMAP requires a ready greeting and valid IMAP capabilities. Use AUTHENTICATE PLAIN when offered; otherwise use escaped LOGIN only when LOGIN is permitted and credentials are ASCII. SMTP requires advertised AUTH PLAIN or LOGIN after TLS; never treat missing authentication as success. This slice does not support OAuth, client certificates, IMAP literals or other SASL mechanisms.
- Response lines are capped at 8 KiB, response sequences at 100 lines, and plaintext/TLS phases each have a 64 KiB response budget. No server response text is included in public errors. Secrets and encoded/quoted authentication buffers use zeroizing owned memory; no claim is made about every OS/library internal copy.
- Commands are greeting/capability/EHLO, STARTTLS, authentication and LOGOUT/QUIT only. No SELECT, FETCH, MAIL FROM, RCPT TO, DATA or mailbox mutation is submitted. There is no automatic credential retry.
- The account-operation lock remains held during a test, preserving its saved-settings snapshot. Other processes refuse concurrent account operations until it completes. Mailbox/SMTP operations are not introduced by this change.

## Evidence

Synthetic loopback TLS servers exercise successful direct TLS and STARTTLS for both protocols, fresh post-upgrade capabilities, refusal of missing STARTTLS, invalid certificate/hostname refusal before authentication, capability/authentication requirements, escaped LOGIN, response limits and expired socket deadlines. DNS tests cover mixed answers and non-public address classes. A fixture-mode guard prevents network tests even if invoked programmatically. GUI acceptance uses that mode to inspect the server confirmation and cancel without accessing real credentials.

The test CA/PKCS#12 identity are invented and included only by `#[cfg(test)]` code. They are never loaded by production connectors or added to OS trust. Mac native-tls uses its own temporary test keychain for the synthetic server identity; sandboxed local testing may require permission to create that temporary keychain. `test/fixtures/rust-verification/README.md` records validity and regeneration. Real-provider and Windows/Linux interactive acceptance remain pending; no personal account was tested.

## Dependency review

native-tls 0.2.18 and base64 0.22.1 are pinned, declare MIT OR Apache-2.0, and provide platform TLS and SASL encoding respectively. native-tls uses Secure Transport on Mac, SChannel on Windows and system OpenSSL on Linux. No vendored OpenSSL or custom certificate validation is used. Linux CI/build prerequisites include `libssl-dev`. Cargo.lock pins transitives; release-time vulnerability/license checks remain required.

Official API: https://docs.rs/native-tls/0.2.18/native_tls/ and its TlsConnectorBuilder documentation. Existing Made Mail protocol/network requirements informed this original implementation; no Mailcraft code or assets were used.
