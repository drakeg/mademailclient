//! Explicit, read-only IMAP receiving. No STORE/MOVE/EXPUNGE or message submission.
mod frame;
use crate::accounts::Settings;
use imap_proto::{
    AttributeValue as A, MailboxDatum as M, NameAttribute, Response as R, ResponseCode, Status,
};
use std::io::{BufReader, Read, Write};
type Result<T> = std::result::Result<T, &'static str>;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Folder {
    pub path: String,
    pub label: String,
    pub selectable: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reference {
    pub folder: String,
    pub validity: u32,
    pub uid: u32,
    pub size: u32,
}
#[derive(Clone, Debug)]
pub struct Header {
    pub reference: Reference,
    pub sender: String,
    pub subject: String,
    pub unread: bool,
}
pub struct Page {
    pub folders: Option<Vec<Folder>>,
    pub headers: Vec<Header>,
}
pub fn page(settings: &Settings, folder: &str, list: bool) -> Result<Page> {
    let mut reader = crate::verify::imap_reader(settings)?;
    page_from(&mut reader, folder, list)
}
pub(crate) fn page_from<S: Read + Write>(
    reader: &mut BufReader<S>,
    folder: &str,
    list: bool,
) -> Result<Page> {
    let folders = if list { Some(folders(reader)?) } else { None };
    let headers = headers(reader, folder)?;
    Ok(Page { folders, headers })
}
pub fn body(settings: &Settings, reference: &Reference) -> Result<String> {
    let mut reader = crate::verify::imap_reader(settings)?;
    body_from(&mut reader, reference)
}
fn command<S: Read + Write>(reader: &mut BufReader<S>, command: &str) -> Result<Vec<R<'static>>> {
    reader
        .get_mut()
        .write_all(format!("R001 {command}\r\n").as_bytes())
        .and_then(|()| reader.get_mut().flush())
        .map_err(|_| "Could not request mail.")?;
    let mut result = Vec::new();
    let mut bytes = 0;
    for _ in 0..1024 {
        let data = frame::frame(reader)?;
        bytes += data.len();
        if bytes > 2_200_000 {
            return Err("Mail operation exceeded the byte limit.");
        }
        let (remaining, response) =
            R::parse(&data).map_err(|_| "Server sent an unsupported mail response.")?;
        if !remaining.is_empty() {
            return Err("Unexpected trailing mail response data.");
        }
        match &response {
            R::Done { tag, status, .. } => {
                if tag.0 != "R001" || *status != Status::Ok {
                    return Err("Server refused the mail request. No messages were changed.");
                }
                result.push(response.into_owned());
                return Ok(result);
            }
            R::Data {
                status: Status::Bye,
                ..
            }
            | R::Continue(_) => return Err("Server interrupted the mail request."),
            _ => result.push(response.into_owned()),
        }
    }
    Err("Mail operation exceeded the response limit.")
}
fn quote(folder: &str) -> Result<String> {
    if folder.is_empty() || folder.len() > 1024 || folder.chars().any(char::is_control) {
        return Err("Invalid folder name.");
    }
    Ok(format!(
        "\"{}\"",
        folder.replace('\\', "\\\\").replace('"', "\\\"")
    ))
}
fn folders<S: Read + Write>(reader: &mut BufReader<S>) -> Result<Vec<Folder>> {
    let mut folders = Vec::new();
    for response in command(reader, "LIST \"\" \"*\"")? {
        if let R::MailboxData(M::List(data)) = response {
            if folders.len() >= 512 {
                return Err("This account exceeds the 512-folder evaluation limit.");
            }
            quote(&data.name)?;
            if folders.iter().any(|f: &Folder| f.path == data.name) {
                continue;
            }
            folders.push(Folder {
                label: folder_label(&data.name)?,
                path: data.name.into_owned(),
                selectable: !data.name_attributes.contains(&NameAttribute::NoSelect),
            });
        }
    }
    if !folders.iter().any(|f| f.path.eq_ignore_ascii_case("INBOX")) {
        if folders.len() == 512 {
            return Err("This account exceeds the 512-folder evaluation limit.");
        }
        folders.insert(
            0,
            Folder {
                path: "INBOX".into(),
                label: "Inbox".into(),
                selectable: true,
            },
        );
    }
    Ok(folders)
}
fn examine<S: Read + Write>(reader: &mut BufReader<S>, folder: &str) -> Result<(u32, u32)> {
    let mut validity = None;
    let mut count = None;
    for response in command(reader, &format!("EXAMINE {}", quote(folder)?))? {
        match response {
            R::MailboxData(M::Exists(n)) => count = Some(n),
            R::Data { outcome, .. } | R::Done { outcome, .. } => {
                if let Some(ResponseCode::UidValidity(n)) = outcome.code {
                    validity = Some(n)
                }
            }
            _ => {}
        }
    }
    Ok((
        validity
            .filter(|n| *n != 0)
            .ok_or("Server did not provide a stable mailbox identity.")?,
        count.ok_or("Server did not provide a mailbox count.")?,
    ))
}
fn headers<S: Read + Write>(reader: &mut BufReader<S>, folder: &str) -> Result<Vec<Header>> {
    let (validity, count) = examine(reader, folder)?;
    if count == 0 {
        return Ok(vec![]);
    }
    let start = count.saturating_sub(49).max(1);
    let request = format!(
        "FETCH {start}:{count} (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])"
    );
    let mut headers = Vec::new();
    for response in command(reader, &request)? {
        if let R::Fetch(seq, attributes) = response {
            if seq < start || seq > count {
                continue;
            }
            let mut uid = None;
            let mut size = None;
            let mut raw = None;
            let mut unread = true;
            for attr in attributes {
                match attr {
                    A::Uid(n) => uid = Some(n),
                    A::Rfc822Size(n) => size = Some(n),
                    A::Flags(flags) => {
                        unread = !flags.iter().any(|f| f.eq_ignore_ascii_case("\\Seen"))
                    }
                    A::BodySection {
                        data: Some(data), ..
                    } => raw = Some(data),
                    _ => {}
                }
            }
            // Ignore unsolicited flag-only updates; never fabricate a message identity.
            let (Some(uid), Some(size), Some(raw)) = (uid, size, raw) else {
                continue;
            };
            if uid == 0
                || headers.iter().any(|h: &Header| h.reference.uid == uid)
                || headers.len() >= 50
                || raw.len() > 65536
            {
                return Err("Invalid or oversized message headers.");
            }
            let parsed = parser()
                .parse_headers(&*raw)
                .ok_or("Could not decode message headers.")?;
            let sender = parsed
                .from()
                .and_then(|a| a.first())
                .and_then(|a| a.name().or(a.address()))
                .unwrap_or("Unknown sender");
            headers.push(Header {
                reference: Reference {
                    folder: folder.into(),
                    validity,
                    uid,
                    size,
                },
                sender: display(sender, 512),
                subject: display(parsed.subject().unwrap_or("(No subject)"), 1024),
                unread,
            });
        }
    }
    headers.sort_by_key(|h| std::cmp::Reverse(h.reference.uid));
    Ok(headers)
}
fn body_from<S: Read + Write>(reader: &mut BufReader<S>, reference: &Reference) -> Result<String> {
    if reference.uid == 0 || reference.size > 1_048_576 {
        return Err("This message exceeds the 1 MiB reading limit.");
    }
    let (validity, _) = examine(reader, &reference.folder)?;
    if validity != reference.validity {
        return Err("Mailbox identity changed. Refresh the folder before opening messages.");
    }
    let mut body = None;
    for response in command(
        reader,
        &format!("UID FETCH {} (UID BODY.PEEK[])", reference.uid),
    )? {
        if let R::Fetch(_, attributes) = response {
            let uid = attributes.iter().find_map(|a| {
                if let A::Uid(uid) = a {
                    Some(*uid)
                } else {
                    None
                }
            });
            if uid != Some(reference.uid) {
                continue;
            }
            for attr in attributes {
                if let A::BodySection {
                    section: None,
                    index: None,
                    data: Some(data),
                } = attr
                {
                    if body.is_some() || data.len() > 1_048_576 {
                        return Err("Invalid or oversized message body.");
                    }
                    let message = parser()
                        .parse(&*data)
                        .ok_or("Could not decode this message.")?;
                    if message.parts().any(|part| {
                        part.flags().contains(mail_parser::PartFlags::LIMIT_REACHED)
                            || part.flags().contains(mail_parser::PartFlags::NESTING_LIMIT)
                    }) {
                        return Err("Message structure exceeds the reading limits.");
                    }
                    let text = message
                        .body_text(0)
                        .unwrap_or_else(|| "No readable text body.".into());
                    let mut preview = display(&text, 262_144);
                    if text.chars().count() > 262_144 {
                        preview.push_str("\n\n[Text preview truncated at 262,144 characters.]");
                    }
                    body = Some(preview);
                }
            }
        }
    }
    body.ok_or("Message is no longer available. Refresh the folder.")
}
fn parser() -> mail_parser::MessageParser {
    mail_parser::MessageParser::default()
        .max_depth(16)
        .max_parts(256)
        .max_encoded_nesting(1)
}
fn display(text: &str, limit: usize) -> String {
    text.chars()
        .filter(|c| !c.is_control() || matches!(c, '\n' | '\t'))
        .take(limit)
        .collect()
}
fn folder_label(raw: &str) -> Result<String> {
    use base64::{Engine, engine::general_purpose::STANDARD_NO_PAD};
    let mut label = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('&') {
        label.push_str(&rest[..start]);
        rest = &rest[start + 1..];
        let end = rest.find('-').ok_or("Invalid encoded folder name.")?;
        if end == 0 {
            label.push('&');
        } else {
            let bytes = STANDARD_NO_PAD
                .decode(rest[..end].replace(',', "/"))
                .map_err(|_| "Invalid encoded folder name.")?;
            if bytes.len() % 2 != 0 {
                return Err("Invalid encoded folder name.");
            }
            let units = bytes
                .as_chunks::<2>()
                .0
                .iter()
                .map(|b| u16::from_be_bytes([b[0], b[1]]))
                .collect::<Vec<_>>();
            label
                .push_str(&String::from_utf16(&units).map_err(|_| "Invalid encoded folder name.")?);
        }
        rest = &rest[end + 1..];
    }
    label.push_str(rest);
    Ok(display(&label, 1024))
}
#[cfg(test)]
mod tests;

pub mod state;
