use super::*;
use std::io::{self, BufReader, Cursor, Read};
struct Script {
    input: Cursor<Vec<u8>>,
    output: Vec<u8>,
}
impl Read for Script {
    fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
        self.input.read(b)
    }
}
impl Write for Script {
    fn write(&mut self, b: &[u8]) -> io::Result<usize> {
        self.output.extend_from_slice(b);
        Ok(b.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
fn script(text: &str) -> BufReader<Script> {
    BufReader::new(Script {
        input: Cursor::new(text.as_bytes().to_vec()),
        output: vec![],
    })
}
#[test]
fn folder_names_and_headers_keep_server_identity() {
    let mut stream = script(
        "* LIST (\\HasNoChildren) \"/\" \"INBOX\"\r\n* LIST (\\Noselect) \"/\" \"Parent\"\r\n* LIST () \"/\" \"&U,BTFw-\"\r\nR001 OK listed\r\n",
    );
    let list = folders(&mut stream).unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(list[2].label, "台北");
    assert!(!list[1].selectable);
    let raw = "From: =?utf-8?Q?Ren=C3=A9?= <fixture@example.invalid>\r\nSubject: Hello\r\n\r\n";
    let mut stream = script(&format!(
        "* 1 EXISTS\r\n* OK [UIDVALIDITY 42] stable\r\nR001 OK [READ-ONLY] ready\r\n* 1 FETCH (UID 7 FLAGS () RFC822.SIZE 200 BODY[HEADER.FIELDS (FROM SUBJECT)] {{{}}}\r\n{})\r\nR001 OK done\r\n",
        raw.len(),
        raw
    ));
    let page = headers(&mut stream, "INBOX").unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(
        page[0].reference,
        Reference {
            folder: "INBOX".into(),
            validity: 42,
            uid: 7,
            size: 200
        }
    );
    assert_eq!(page[0].sender, "René");
    assert!(page[0].unread);
    let commands = String::from_utf8_lossy(&stream.get_ref().output);
    assert!(commands.contains("EXAMINE \"INBOX\""));
    assert!(commands.contains("BODY.PEEK[HEADER.FIELDS"));
    assert!(!commands.contains("SELECT "));
}
#[test]
fn body_is_read_only_and_rejects_replaced_mailbox() {
    let reference = Reference {
        folder: "INBOX".into(),
        validity: 42,
        uid: 7,
        size: 200,
    };
    let raw = "Content-Type: text/html; charset=utf-8\r\n\r\n<p>Hello</p><script>evil()</script><img src=\"https://example.invalid/pixel\">";
    let mut stream = script(&format!(
        "* 1 EXISTS\r\n* OK [UIDVALIDITY 42] stable\r\nR001 OK ready\r\n* 1 FETCH (UID 7 BODY[] {{{}}}\r\n{})\r\nR001 OK done\r\n",
        raw.len(),
        raw
    ));
    let text = body_from(&mut stream, &reference).unwrap_or_else(|e| panic!("{e}"));
    assert!(text.contains("Hello"));
    assert!(!text.contains("<img"));
    assert!(
        String::from_utf8_lossy(&stream.get_ref().output).contains("UID FETCH 7 (UID BODY.PEEK[])")
    );
    let mut changed = script("* 1 EXISTS\r\n* OK [UIDVALIDITY 43] replaced\r\nR001 OK ready\r\n");
    assert!(body_from(&mut changed, &reference).is_err());
    assert!(!String::from_utf8_lossy(&changed.get_ref().output).contains("FETCH"));
    let mut oversized = script("");
    let mut reference = reference;
    reference.size = 1_048_577;
    assert!(body_from(&mut oversized, &reference).is_err());
    assert!(oversized.get_ref().output.is_empty());
}
#[test]
fn command_injection_and_wrong_tags_fail_closed() {
    for name in ["bad\r\nSTORE 1 +FLAGS \\Deleted", "", "\0"] {
        assert!(quote(name).is_err());
    }
    assert_eq!(
        quote("a\"b\\c").unwrap_or_else(|e| panic!("{e}")),
        "\"a\\\"b\\\\c\""
    );
    assert!(command(&mut script("X OK wrong\r\n"), "LIST \"\" \"*\"").is_err());
    assert!(
        command(
            &mut script("R001 NO secret raw response\r\n"),
            "LIST \"\" \"*\""
        )
        .err()
        .unwrap_or_else(|| panic!("expected rejection"))
        .contains("refused")
    );
}

#[test]
fn text_preview_is_explicitly_truncated_and_message_complexity_is_bounded() {
    let text = "x".repeat(262_145);
    let mut raw = format!("Content-Type: text/plain\r\n\r\n{text}");
    let reference = Reference {
        folder: "INBOX".into(),
        validity: 1,
        uid: 1,
        size: raw.len() as u32,
    };
    let input = |raw: &str| {
        format!(
            "* 1 EXISTS\r\n* OK [UIDVALIDITY 1] ready\r\nR001 OK ready\r\n* 1 FETCH (UID 1 BODY[] {{{}}}\r\n{})\r\nR001 OK done\r\n",
            raw.len(),
            raw
        )
    };
    let body = body_from(&mut script(&input(&raw)), &reference).unwrap_or_else(|e| panic!("{e}"));
    assert!(body.ends_with("[Text preview truncated at 262,144 characters.]"));
    raw = "Content-Type: multipart/mixed; boundary=x\r\n\r\n".into();
    for _ in 0..260 {
        raw.push_str("--x\r\nContent-Type: text/plain\r\n\r\npart\r\n");
    }
    raw.push_str("--x--\r\n");
    assert!(body_from(&mut script(&input(&raw)), &reference).is_err());
}
