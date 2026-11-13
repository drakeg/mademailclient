//! Bounded, explicit credential verification. No mailbox reads or SMTP submission.
mod network;
use crate::accounts::{Security, Settings};
use base64::{Engine, engine::general_purpose::STANDARD};
use native_tls::{TlsConnector, TlsStream};
use network::DeadlineStream;
use std::{
    io::{BufRead, BufReader, Read, Write},
    time::{Duration, Instant},
};
use zeroize::Zeroizing;
type Result<T> = std::result::Result<T, &'static str>;
pub struct Verification {
    pub imap: Result<()>,
    pub smtp: Result<()>,
}
pub fn verify(settings: &Settings) -> Verification {
    if let Err(error) = settings.validate() {
        return Verification {
            imap: Err(error),
            smtp: Err(error),
        };
    }
    let connector = match TlsConnector::builder()
        .min_protocol_version(Some(native_tls::Protocol::Tlsv12))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            return Verification {
                imap: Err("Could not initialize trusted TLS."),
                smtp: Err("Could not initialize trusted TLS."),
            };
        }
    };
    Verification {
        imap: check(
            &settings.imap_host,
            settings.imap_port,
            settings.imap_security,
            &settings.imap_user,
            &settings.imap_password,
            true,
            &connector,
        ),
        smtp: check(
            &settings.smtp_host,
            settings.smtp_port,
            settings.smtp_security,
            &settings.smtp_user,
            &settings.smtp_password,
            false,
            &connector,
        ),
    }
}
struct Wire<S> {
    reader: BufReader<S>,
    budget: usize,
}
impl<S: Read + Write> Wire<S> {
    fn new(stream: S) -> Self {
        Self {
            reader: BufReader::new(stream),
            budget: 65536,
        }
    }
    fn line(&mut self) -> Result<String> {
        let mut line = Vec::new();
        loop {
            let buffer = self
                .reader
                .fill_buf()
                .map_err(|_| "Server response timed out or the connection closed.")?;
            if buffer.is_empty() {
                return Err("Server closed the connection unexpectedly.");
            }
            let n = buffer
                .iter()
                .position(|b| *b == b'\n')
                .map_or(buffer.len(), |i| i + 1);
            if n > self.budget || line.len() + n > 8192 {
                return Err("Server response exceeded the safety limit.");
            }
            self.budget -= n;
            line.extend_from_slice(&buffer[..n]);
            self.reader.consume(n);
            if line.ends_with(b"\n") {
                break;
            }
        }
        if !line.ends_with(b"\r\n") || line[..line.len() - 2].contains(&0) {
            return Err("Server sent an invalid protocol response.");
        }
        line.truncate(line.len() - 2);
        String::from_utf8(line).map_err(|_| "Server sent an invalid protocol response.")
    }
    fn send(&mut self, command: &str) -> Result<()> {
        self.reader
            .get_mut()
            .write_all(command.as_bytes())
            .and_then(|()| self.reader.get_mut().write_all(b"\r\n"))
            .and_then(|()| self.reader.get_mut().flush())
            .map_err(|_| "Could not send the verification command.")
    }
    fn finish(self) -> Result<S> {
        if !self.reader.buffer().is_empty() {
            return Err("Unexpected data at the TLS upgrade boundary.");
        }
        Ok(self.reader.into_inner())
    }
    fn imap_reply(&mut self, tag: &str) -> Result<Vec<String>> {
        let mut lines = vec![];
        for _ in 0..100 {
            let line = self.line()?;
            if let Some(rest) = line.strip_prefix(&format!("{tag} ")) {
                if rest
                    .split_whitespace()
                    .next()
                    .is_some_and(|word| word.eq_ignore_ascii_case("OK"))
                {
                    return Ok(lines);
                }
                return Err(
                    "IMAP rejected the command. Check the account's sign-in method and settings.",
                );
            }
            if !line.starts_with("* ") {
                return Err("Unexpected IMAP response.");
            }
            lines.push(line);
        }
        Err("Too many IMAP response lines.")
    }
    fn imap_caps(&mut self) -> Result<Vec<String>> {
        self.send("V003 CAPABILITY")?;
        let lines = self.imap_reply("V003")?;
        let mut caps = Vec::new();
        for line in lines {
            let mut words = line.split_whitespace();
            if words.next() == Some("*")
                && words
                    .next()
                    .is_some_and(|word| word.eq_ignore_ascii_case("CAPABILITY"))
            {
                caps.extend(words.map(str::to_ascii_uppercase));
            }
        }
        if !caps
            .iter()
            .any(|cap| cap == "IMAP4REV1" || cap == "IMAP4REV2")
        {
            return Err(
                "IMAP server did not return supported capabilities. No credentials were sent.",
            );
        }
        Ok(caps)
    }
    fn smtp_reply(&mut self, expected: &str) -> Result<Vec<String>> {
        let mut lines = vec![];
        for _ in 0..100 {
            let line = self.line()?;
            if line.len() < 4 || !line.starts_with(expected) {
                return Err(
                    "SMTP rejected the command. Check the account's sign-in method and settings.",
                );
            }
            let separator = line.as_bytes()[3];
            if separator != b' ' && separator != b'-' {
                return Err("Invalid SMTP response.");
            }
            lines.push(line[4..].to_ascii_uppercase());
            if separator == b' ' {
                return Ok(lines);
            }
        }
        Err("Too many SMTP response lines.")
    }
    fn ehlo(&mut self) -> Result<Vec<String>> {
        self.send("EHLO mademail.invalid")?;
        self.smtp_reply("250")
    }
}
fn tls(
    stream: DeadlineStream,
    host: &str,
    connector: &TlsConnector,
) -> Result<Wire<TlsStream<DeadlineStream>>> {
    connector.connect(host,stream).map(Wire::new).map_err(|_| { "TLS verification failed or timed out. Check the server hostname, certificate and system clock. Certificate checks were not bypassed." })
}
fn check(
    host: &str,
    port: u16,
    security: Security,
    user: &str,
    password: &str,
    imap: bool,
    connector: &TlsConnector,
) -> Result<()> {
    let deadline = Instant::now() + Duration::from_secs(25);
    let stream = DeadlineStream::connect(network::resolve(host, port)?, deadline)?;
    check_stream(stream, host, security, user, password, imap, connector)
}
fn check_stream(
    stream: DeadlineStream,
    host: &str,
    security: Security,
    user: &str,
    password: &str,
    imap: bool,
    connector: &TlsConnector,
) -> Result<()> {
    let mut secure = if security == Security::Tls {
        let mut secure = tls(stream, host, connector)?;
        if imap {
            if !secure.line()?.to_ascii_uppercase().starts_with("* OK ") {
                return Err("IMAP did not send a ready greeting.");
            }
        } else {
            secure.smtp_reply("220")?;
        }
        secure
    } else {
        let mut plain = Wire::new(stream);
        if imap {
            if !plain.line()?.to_ascii_uppercase().starts_with("* OK ") {
                return Err("IMAP did not send a ready greeting.");
            }
            if !plain.imap_caps()?.iter().any(|c| c == "STARTTLS") {
                return Err("IMAP server does not offer STARTTLS. No credentials were sent.");
            }
            plain.send("V002 STARTTLS")?;
            plain.imap_reply("V002")?;
        } else {
            plain.smtp_reply("220")?;
            if !plain.ehlo()?.iter().any(|c| c == "STARTTLS") {
                return Err("SMTP server does not offer STARTTLS. No credentials were sent.");
            }
            plain.send("STARTTLS")?;
            plain.smtp_reply("220")?;
        }
        tls(plain.finish()?, host, connector)?
    };
    if imap {
        imap_auth(&mut secure, user, password)?;
        let _ = secure.send("V005 LOGOUT");
    } else {
        smtp_auth(&mut secure, user, password)?;
        let _ = secure.send("QUIT");
    }
    Ok(())
}
fn payload(user: &str, password: &str) -> Zeroizing<String> {
    let mut bytes = Zeroizing::new(Vec::with_capacity(user.len() + password.len() + 2));
    bytes.push(0);
    bytes.extend_from_slice(user.as_bytes());
    bytes.push(0);
    bytes.extend_from_slice(password.as_bytes());
    Zeroizing::new(STANDARD.encode(&*bytes))
}
fn imap_auth<S: Read + Write>(wire: &mut Wire<S>, user: &str, password: &str) -> Result<()> {
    let caps = wire.imap_caps()?;
    if caps.iter().any(|c| c == "AUTH=PLAIN") {
        wire.send("V004 AUTHENTICATE PLAIN")?;
        if !wire.line()?.starts_with('+') {
            return Err("IMAP authentication was refused.");
        }
        wire.send(&payload(user, password))?;
        wire.imap_reply("V004")?;
    } else {
        if caps.iter().any(|c| c == "LOGINDISABLED") || !user.is_ascii() || !password.is_ascii() {
            return Err("IMAP needs an unsupported sign-in method. No credentials were sent.");
        }
        let quote = |s: &str| s.replace('\\', "\\\\").replace('"', "\\\"");
        let quoted_user = Zeroizing::new(quote(user));
        let quoted_password = Zeroizing::new(quote(password));
        let command = Zeroizing::new(format!(
            "V004 LOGIN \"{}\" \"{}\"",
            quoted_user.as_str(),
            quoted_password.as_str()
        ));
        wire.send(&command)?;
        wire.imap_reply("V004")?;
    }
    Ok(())
}
fn smtp_auth<S: Read + Write>(wire: &mut Wire<S>, user: &str, password: &str) -> Result<()> {
    let caps = wire.ehlo()?;
    let mechanisms = caps
        .iter()
        .filter_map(|line| line.strip_prefix("AUTH "))
        .flat_map(str::split_whitespace)
        .collect::<Vec<_>>();
    if mechanisms.contains(&"PLAIN") {
        wire.send("AUTH PLAIN")?;
        wire.smtp_reply("334")?;
        wire.send(&payload(user, password))?;
        wire.smtp_reply("235")?;
    } else if mechanisms.contains(&"LOGIN") {
        wire.send("AUTH LOGIN")?;
        wire.smtp_reply("334")?;
        wire.send(&Zeroizing::new(STANDARD.encode(user)))?;
        wire.smtp_reply("334")?;
        wire.send(&Zeroizing::new(STANDARD.encode(password)))?;
        wire.smtp_reply("235")?;
    } else {
        return Err("SMTP does not advertise supported authentication. No credentials were sent.");
    }
    Ok(())
}
#[cfg(test)]
mod tests;
