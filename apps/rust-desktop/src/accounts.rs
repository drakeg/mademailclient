//! Account settings and credential-store boundary. No network or Electron-profile access.
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};
const SERVICE: &str = "com.mademailclient.rust.accounts.v1";
const REGISTRY: &str = "registry-v1";
const MAX_BYTES: usize = 2300;
type Result<T> = std::result::Result<T, &'static str>;
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Security {
    #[default]
    Tls,
    StartTls,
}
#[derive(Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub email: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: Security,
    pub imap_user: String,
    pub imap_password: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: Security,
    pub smtp_user: String,
    pub smtp_password: String,
}
impl Drop for Settings {
    fn drop(&mut self) {
        self.imap_password.zeroize();
        self.smtp_password.zeroize();
    }
}
impl Settings {
    pub fn validate(&self) -> Result<()> {
        if self.email.len() > 254
            || self.email.matches('@').count() != 1
            || self.email.split('@').any(str::is_empty)
            || self
                .email
                .chars()
                .any(|c| c.is_whitespace() || c.is_control())
        {
            return Err("Enter a valid email address.");
        }
        for host in [&self.imap_host, &self.smtp_host] {
            if host.is_empty()
                || host.len() > 253
                || host.split('.').any(|part| {
                    part.is_empty()
                        || part.len() > 63
                        || part.starts_with('-')
                        || part.ends_with('-')
                        || !part.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
                })
            {
                return Err("Enter server hostnames, without a URL, path or port.");
            }
        }
        if self.imap_port == 0 || self.smtp_port == 0 {
            return Err("Enter ports between 1 and 65535.");
        }
        for user in [&self.imap_user, &self.smtp_user] {
            if user.is_empty() || user.len() > 254 || user.chars().any(char::is_control) {
                return Err("Enter valid IMAP and SMTP usernames.");
            }
        }
        for secret in [&self.imap_password, &self.smtp_password] {
            if secret.is_empty() || secret.len() > 1024 || secret.chars().any(char::is_control) {
                return Err("Enter server passwords or app passwords (maximum 1024 bytes).");
            }
        }
        Ok(())
    }
}
pub struct SavedAccount {
    pub id: String,
    pub label: String,
    pub incomplete: bool,
    pub endpoints: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Registry {
    version: u8,
    ids: Vec<String>,
}
pub trait SecretStore {
    fn read(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>>;
    fn write(&self, key: &str, value: &[u8]) -> Result<()>;
    fn remove(&self, key: &str) -> Result<()>;
}
fn valid_id(id: &str) -> bool {
    uuid::Uuid::parse_str(id)
        .is_ok_and(|uuid| uuid.get_version_num() == 4 && uuid.to_string() == id)
}
fn registry(store: &dyn SecretStore) -> Result<Registry> {
    let Some(bytes) = store.read(REGISTRY)? else {
        return Ok(Registry {
            version: 1,
            ids: vec![],
        });
    };
    if bytes.len() > MAX_BYTES {
        return Err("Saved account index is invalid. Existing settings were preserved.");
    }
    let r: Registry = serde_json::from_slice(&bytes)
        .map_err(|_| "Saved account index is invalid. Existing settings were preserved.")?;
    let unique: std::collections::HashSet<_> = r.ids.iter().collect();
    if r.version != 1
        || r.ids.len() > 32
        || unique.len() != r.ids.len()
        || r.ids.iter().any(|id| !valid_id(id))
    {
        return Err("Saved account index is invalid. Existing settings were preserved.");
    }
    Ok(r)
}
fn write_index(store: &dyn SecretStore, r: &Registry) -> Result<()> {
    let bytes =
        Zeroizing::new(serde_json::to_vec(r).map_err(|_| "Could not encode account index.")?);
    if bytes.len() > MAX_BYTES {
        return Err("Account index is full.");
    }
    store.write(REGISTRY, &bytes)
}
pub fn list(store: &dyn SecretStore) -> Result<Vec<SavedAccount>> {
    let mut saved = vec![];
    for id in registry(store)?.ids {
        let data = store.read(&id)?;
        let settings = match data {
            Some(bytes) if bytes.len() <= MAX_BYTES => serde_json::from_slice::<Settings>(&bytes)
                .ok()
                .filter(|s| s.validate().is_ok()),
            _ => None,
        };
        saved.push(SavedAccount {
            id,
            label: settings
                .as_ref()
                .map(|s| s.email.clone())
                .unwrap_or_else(|| "Incomplete account settings — remove and add again".into()),
            endpoints: settings
                .as_ref()
                .map(|s| {
                    format!(
                        "IMAP {}:{} ({}) · SMTP {}:{} ({})",
                        s.imap_host,
                        s.imap_port,
                        if s.imap_security == Security::Tls {
                            "TLS"
                        } else {
                            "STARTTLS"
                        },
                        s.smtp_host,
                        s.smtp_port,
                        if s.smtp_security == Security::Tls {
                            "TLS"
                        } else {
                            "STARTTLS"
                        }
                    )
                })
                .unwrap_or_default(),
            incomplete: settings.is_none(),
        });
    }
    Ok(saved)
}
pub fn load(store: &dyn SecretStore, id: &str) -> Result<Settings> {
    if !valid_id(id) || !registry(store)?.ids.iter().any(|saved| saved == id) {
        return Err("Choose a current saved account.");
    }
    let bytes = store
        .read(id)?
        .ok_or("Saved settings are incomplete. Remove and add this entry again.")?;
    if bytes.len() > MAX_BYTES {
        return Err("Saved settings exceed the safety limit.");
    }
    let settings: Settings =
        serde_json::from_slice(&bytes).map_err(|_| "Saved settings are invalid.")?;
    settings.validate()?;
    Ok(settings)
}
pub fn add(store: &dyn SecretStore, settings: Settings) -> Result<Vec<SavedAccount>> {
    settings.validate()?;
    let bytes =
        Zeroizing::new(serde_json::to_vec(&settings).map_err(|_| "Could not encode settings.")?);
    if bytes.len() > MAX_BYTES {
        return Err("Combined account settings exceed the credential store size limit.");
    }
    let mut r = registry(store)?;
    if r.ids.len() >= 32 {
        return Err("This evaluation supports up to 32 saved accounts.");
    }
    let id = uuid::Uuid::new_v4().to_string();
    r.ids.push(id.clone());
    // Reserve first: failed writes remain discoverable/removable, never orphan credentials.
    write_index(store, &r)?;
    store.write(&id,&bytes).map_err(|_|"Account save was not confirmed. Reload Accounts before retrying; remove any incomplete entry.")?;
    list(store)
}
pub fn remove(store: &dyn SecretStore, id: &str) -> Result<Vec<SavedAccount>> {
    if !valid_id(id) {
        return Err("Choose a saved account.");
    }
    let mut r = registry(store)?;
    if !r.ids.iter().any(|saved| saved == id) {
        return Err("Account is not in this application's index.");
    }
    // Delete the secret first; an index-write failure leaves a removable incomplete entry.
    store.remove(id)?;
    r.ids.retain(|saved| saved != id);
    write_index(store, &r)?;
    list(store)
}
pub struct OsStore {
    _lock: std::fs::File,
    backend: std::sync::Arc<keyring_core::CredentialStore>,
}
impl OsStore {
    pub fn open() -> Result<Self> {
        #[cfg(target_os = "windows")]
        let root = std::env::var_os("LOCALAPPDATA");
        #[cfg(not(target_os = "windows"))]
        let root = std::env::var_os("HOME");
        let path = std::path::PathBuf::from(
            root.ok_or("Could not locate the local Rust settings directory.")?,
        )
        .join(".made-mail-rust-evaluation");
        std::fs::create_dir_all(&path)
            .map_err(|_| "Could not prepare the local Rust operation lock.")?;
        let lock = lock_at(&path.join("accounts.lock"))?;
        #[cfg(target_os = "macos")]
        let backend = apple_native_keyring_store::keychain::Store::new();
        #[cfg(target_os = "windows")]
        let backend = windows_native_keyring_store::Store::new();
        #[cfg(target_os = "linux")]
        let backend = dbus_secret_service_keyring_store::Store::new();
        let backend = backend.map_err(
            |_| "The OS credential store is unavailable or locked. No plaintext fallback is used.",
        )?;
        Ok(Self {
            _lock: lock,
            backend,
        })
    }
    fn entry(&self, key: &str) -> Result<keyring_core::Entry> {
        if key != REGISTRY && !valid_id(key) {
            return Err("Invalid credential identifier.");
        }
        #[cfg(target_os = "windows")]
        let modifiers = std::collections::HashMap::from([("persistence", "Local")]);
        #[cfg(not(target_os = "windows"))]
        let modifiers = std::collections::HashMap::new();
        self.backend
            .build(SERVICE, key, Some(&modifiers))
            .map_err(|_| "Could not access this application's credential entry.")
    }
}
fn lock_at(path: &std::path::Path) -> Result<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
        .map_err(|_| "Could not open the account operation lock.")?;
    file.try_lock().map_err(
        |_| "Another Rust account operation is in progress. Try again when it finishes.",
    )?;
    Ok(file)
}
impl SecretStore for OsStore {
    fn read(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>> {
        match self.entry(key)?.get_secret() {
            Ok(bytes) => Ok(Some(Zeroizing::new(bytes))),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(_) => Err("Could not unlock saved settings. Existing data was preserved."),
        }
    }
    fn write(&self, key: &str, value: &[u8]) -> Result<()> {
        self.entry(key)?
            .set_secret(value)
            .map_err(|_| "The OS credential store refused the save. No plaintext fallback is used.")
    }
    fn remove(&self, key: &str) -> Result<()> {
        match self.entry(key)?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(_) => {
                Err("The OS credential store refused removal. The account index was preserved.")
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    #[derive(Default)]
    struct Memory {
        data: RefCell<std::collections::HashMap<String, Vec<u8>>>,
        fail_record: bool,
        fail_read: bool,
        fail_index: std::cell::Cell<bool>,
    }
    impl SecretStore for Memory {
        fn read(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>> {
            if self.fail_read {
                return Err("locked");
            }
            Ok(self.data.borrow().get(key).cloned().map(Zeroizing::new))
        }
        fn write(&self, key: &str, value: &[u8]) -> Result<()> {
            if key == REGISTRY && self.fail_index.replace(false) {
                return Err("index write failed");
            }
            if self.fail_record && key != REGISTRY {
                return Err("write failed");
            }
            self.data.borrow_mut().insert(key.into(), value.into());
            Ok(())
        }
        fn remove(&self, key: &str) -> Result<()> {
            self.data.borrow_mut().remove(key);
            Ok(())
        }
    }
    fn settings() -> Settings {
        Settings {
            email: "alex@example.invalid".into(),
            imap_host: "imap.example.invalid".into(),
            imap_port: 993,
            imap_user: "alex".into(),
            imap_password: "synthetic-incoming".into(),
            smtp_host: "smtp.example.invalid".into(),
            smtp_port: 465,
            smtp_user: "sender".into(),
            smtp_password: "synthetic-outgoing".into(),
            ..Default::default()
        }
    }
    #[test]
    fn add_reload_remove_and_account_isolation() {
        let store = Memory::default();
        let a = add(&store, settings()).unwrap_or_else(|e| panic!("{e}"));
        let b = add(&store, settings()).unwrap_or_else(|e| panic!("{e}"));
        assert_ne!(a[0].id, b[1].id);
        assert_eq!(list(&store).map(|s| s.len()), Ok(2));
        let left = remove(&store, &a[0].id).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].id, b[1].id);
        assert!(!store.data.borrow().contains_key(&a[0].id));
        assert!(remove(&store, "registry-v1").is_err());
        assert!(remove(&store, &uuid::Uuid::new_v4().to_string()).is_err());
    }
    #[test]
    fn invalid_input_never_writes_credentials() {
        let store = Memory::default();
        for invalid in [
            "https://imap.example.invalid",
            "host\r\nLOGIN",
            "localhost:993",
            "-bad.example",
        ] {
            let mut s = settings();
            s.imap_host = invalid.into();
            assert!(add(&store, s).is_err());
        }
        let mut s = settings();
        s.smtp_port = 0;
        assert!(add(&store, s).is_err());
        assert!(store.data.borrow().is_empty());
    }
    #[test]
    fn failed_save_is_discoverable_and_removable_without_secret_orphan() {
        let store = Memory {
            fail_record: true,
            ..Default::default()
        };
        assert!(add(&store, settings()).is_err());
        let pending = list(&store).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(pending.len(), 1);
        assert!(pending[0].incomplete);
        assert!(remove(&store, &pending[0].id).is_ok());
        assert_eq!(list(&store).map(|s| s.len()), Ok(0));
    }
    #[test]
    fn interrupted_remove_can_be_retried_without_losing_other_settings() {
        let store = Memory::default();
        let saved = add(&store, settings()).unwrap_or_else(|e| panic!("{e}"));
        store.fail_index.set(true);
        assert!(remove(&store, &saved[0].id).is_err());
        assert!(!store.data.borrow().contains_key(&saved[0].id));
        let pending = list(&store).unwrap_or_else(|e| panic!("{e}"));
        assert!(pending[0].incomplete);
        assert_eq!(remove(&store, &saved[0].id).map(|rows| rows.len()), Ok(0));
    }
    #[test]
    fn oversized_secret_payload_is_refused_before_reserving_an_entry() {
        let store = Memory::default();
        let mut value = settings();
        value.imap_password = "x".repeat(1024);
        value.smtp_password = "y".repeat(1024);
        assert!(add(&store, value).is_err());
        assert!(store.data.borrow().is_empty());
    }
    #[test]
    fn locked_or_corrupt_index_is_never_treated_as_empty() {
        let locked = Memory {
            fail_read: true,
            ..Default::default()
        };
        assert!(add(&locked, settings()).is_err());
        assert!(list(&locked).is_err());
        let store = Memory::default();
        store
            .data
            .borrow_mut()
            .insert(REGISTRY.into(), b"invalid".to_vec());
        assert!(add(&store, settings()).is_err());
        assert_eq!(store.data.borrow().len(), 1);
    }
}

#[cfg(test)]
mod lock_tests {
    #[test]
    fn concurrent_account_operations_cannot_overwrite_the_index() {
        let path = std::env::temp_dir().join(format!("made-mail-lock-{}", uuid::Uuid::new_v4()));
        let first = super::lock_at(&path).unwrap_or_else(|e| panic!("{e}"));
        assert!(super::lock_at(&path).is_err());
        drop(first);
        let next = super::lock_at(&path).unwrap_or_else(|e| panic!("{e}"));
        drop(next);
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(all(test, target_os = "macos"))]
mod native_store_tests {
    #[test]
    #[ignore = "Explicit local acceptance only: creates and deletes one synthetic Keychain entry"]
    fn isolated_mac_keychain_roundtrip() -> Result<(), Box<dyn std::error::Error>> {
        use keyring_core::api::CredentialStoreApi;
        struct Cleanup(keyring_core::Entry);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = self.0.delete_credential();
            }
        }
        let backend = apple_native_keyring_store::keychain::Store::new()?;
        let service = format!(
            "com.mademailclient.synthetic-check.{}",
            uuid::Uuid::new_v4()
        );
        let guard = Cleanup(backend.build(&service, "synthetic-fixture", None)?);
        guard.0.set_secret(b"fictional-store-check")?;
        let reopened = backend.build(&service, "synthetic-fixture", None)?;
        assert_eq!(reopened.get_secret()?, b"fictional-store-check");
        reopened.delete_credential()?;
        assert!(matches!(
            reopened.get_secret(),
            Err(keyring_core::Error::NoEntry)
        ));
        Ok(())
    }
}

#[cfg(test)]
mod credential_access_tests {
    use super::*;
    struct Unowned;
    impl SecretStore for Unowned {
        fn read(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>> {
            assert_eq!(key, REGISTRY);
            Ok(None)
        }
        fn write(&self, _: &str, _: &[u8]) -> Result<()> {
            panic!("verification must not write credentials")
        }
        fn remove(&self, _: &str) -> Result<()> {
            panic!("verification must not remove credentials")
        }
    }
    #[test]
    fn credential_loading_requires_index_membership() {
        assert!(load(&Unowned, &uuid::Uuid::new_v4().to_string()).is_err());
        assert!(load(&Unowned, "registry-v1").is_err());
    }
}
