use crate::accounts::{Security, Settings};

pub fn apply(settings: &mut Settings) -> Result<&'static str, &'static str> {
    let email = settings.email.clone();
    if email.len() > 254
        || email.matches('@').count() != 1
        || email.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err("Enter an email address first.");
    }
    let (user, domain) = email
        .rsplit_once('@')
        .ok_or("Enter an email address first.")?;
    if user.is_empty() {
        return Err("Enter an email address first.");
    }
    let (imap, smtp, icloud, note) = match domain.to_ascii_lowercase().as_str() {
        "gmail.com" => (
            "imap.gmail.com",
            "smtp.gmail.com",
            false,
            "Gmail server defaults filled. An app password may be required; browser sign-in is not available yet.",
        ),
        "yahoo.com" => (
            "imap.mail.yahoo.com",
            "smtp.mail.yahoo.com",
            false,
            "Yahoo server defaults filled. Use a Yahoo-generated app password.",
        ),
        "icloud.com" => (
            "imap.mail.me.com",
            "smtp.mail.me.com",
            true,
            "iCloud server defaults filled. Use an app-specific password. If the incoming username fails, try the full email address.",
        ),
        "outlook.com" | "hotmail.com" | "live.com" | "msn.com" => {
            return Err(
                "Microsoft requires modern browser sign-in. Rust OAuth is not implemented yet; no settings were filled.",
            );
        }
        _ => {
            return Err(
                "No built-in preset for this domain. Enter IMAP and SMTP settings manually.",
            );
        }
    };
    if !settings.imap_host.is_empty()
        || !settings.smtp_host.is_empty()
        || !settings.imap_user.is_empty()
        || !settings.smtp_user.is_empty()
        || settings.imap_port != 993
        || settings.smtp_port != 465
        || settings.imap_security != Security::Tls
        || settings.smtp_security != Security::Tls
    {
        return Err(
            "Existing server, username or security settings were preserved. Use presets before entering custom settings.",
        );
    }
    settings.imap_host = imap.into();
    settings.smtp_host = smtp.into();
    settings.imap_user = if icloud { user.into() } else { email.clone() };
    settings.smtp_user = email;
    if icloud {
        settings.smtp_port = 587;
        settings.smtp_security = Security::StartTls;
    }
    Ok(note)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn blank(email: &str) -> Settings {
        let mut settings = Settings::default();
        settings.email = email.into();
        settings.imap_port = 993;
        settings.smtp_port = 465;
        settings
    }
    #[test]
    fn known_domains_fill_both_endpoints_without_touching_passwords() {
        let mut gmail = blank("Alex@GMAIL.COM");
        gmail.imap_password = "fictional-incoming".into();
        gmail.smtp_password = "fictional-outgoing".into();
        assert!(apply(&mut gmail).is_ok());
        assert_eq!(gmail.imap_host, "imap.gmail.com");
        assert_eq!(gmail.smtp_host, "smtp.gmail.com");
        assert_eq!(gmail.imap_user, "Alex@GMAIL.COM");
        assert_eq!(gmail.imap_password, "fictional-incoming");
        assert_eq!(gmail.smtp_password, "fictional-outgoing");
        let mut yahoo = blank("alex@yahoo.com");
        assert!(apply(&mut yahoo).is_ok());
        assert_eq!(yahoo.imap_host, "imap.mail.yahoo.com");
        assert_eq!(yahoo.smtp_host, "smtp.mail.yahoo.com");
    }
    #[test]
    fn icloud_uses_documented_username_and_starttls_defaults() {
        let mut value = blank("alex@icloud.com");
        assert!(apply(&mut value).is_ok());
        assert_eq!(value.imap_user, "alex");
        assert_eq!(value.smtp_user, "alex@icloud.com");
        assert_eq!(value.smtp_port, 587);
        assert!(value.smtp_security == Security::StartTls);
    }
    #[test]
    fn custom_settings_unknown_and_microsoft_addresses_are_never_overwritten() {
        for email in [
            "alex@gmail.com.attacker.invalid",
            "alex@unknown.invalid",
            "alex@outlook.com",
            "bad@@gmail.com",
        ] {
            let mut value = blank(email);
            assert!(apply(&mut value).is_err());
            assert!(value.imap_host.is_empty());
            assert!(value.smtp_host.is_empty());
        }
        let mut custom = blank("alex@gmail.com");
        custom.imap_host = "custom.example.invalid".into();
        assert!(apply(&mut custom).is_err());
        assert_eq!(custom.imap_host, "custom.example.invalid");
        assert!(custom.smtp_host.is_empty());
        let mut port = blank("alex@gmail.com");
        port.smtp_port = 2525;
        assert!(apply(&mut port).is_err());
        assert_eq!(port.smtp_port, 2525);
    }
}
