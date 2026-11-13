use super::*;
use std::{
    io::Cursor,
    net::{TcpListener, TcpStream},
    sync::{Arc, Mutex},
};
#[derive(Clone)]
struct Memory {
    input: Cursor<Vec<u8>>,
    output: Arc<Mutex<Vec<u8>>>,
}
impl Read for Memory {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.input.read(buf)
    }
}
impl Write for Memory {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.output
            .lock()
            .map_err(|_| std::io::Error::other("fixture"))?
            .extend_from_slice(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
fn memory(input: &str) -> (Wire<Memory>, Arc<Mutex<Vec<u8>>>) {
    let output = Arc::new(Mutex::new(vec![]));
    (
        Wire::new(Memory {
            input: Cursor::new(input.as_bytes().into()),
            output: output.clone(),
        }),
        output,
    )
}
#[test]
fn authentication_is_required_and_responses_are_bounded() {
    let (mut wire, output) = memory("250 fixture\r\n");
    assert!(smtp_auth(&mut wire, "user", "secret").is_err());
    assert_eq!(
        *output.lock().unwrap_or_else(|e| panic!("{e}")),
        b"EHLO mademail.invalid\r\n"
    );
    let (mut wire, output) = memory("* CAPABILITY IMAP4rev1 LOGINDISABLED\r\nV003 OK ready\r\n");
    assert!(imap_auth(&mut wire, "user", "secret").is_err());
    assert_eq!(
        *output.lock().unwrap_or_else(|e| panic!("{e}")),
        b"V003 CAPABILITY\r\n"
    );
    let (mut wire, _) = memory(&"x".repeat(8193));
    assert!(wire.line().is_err());
    let (wire, _) = memory("unexpected");
    let mut wire = wire;
    assert!(wire.reader.fill_buf().is_ok());
    assert!(wire.finish().is_err());
}
fn connector(trusted: bool) -> TlsConnector {
    let mut builder = TlsConnector::builder();
    builder.min_protocol_version(Some(native_tls::Protocol::Tlsv12));
    if trusted {
        builder.add_root_certificate(
            native_tls::Certificate::from_pem(include_bytes!(
                "../../../../test/fixtures/rust-verification/root.pem"
            ))
            .unwrap_or_else(|e| panic!("{e}")),
        );
    }
    builder.build().unwrap_or_else(|e| panic!("{e}"))
}
fn identity() -> native_tls::TlsAcceptor {
    let identity = native_tls::Identity::from_pkcs12(
        include_bytes!("../../../../test/fixtures/rust-verification/server.p12"),
        "made-mail-fixture",
    )
    .unwrap_or_else(|e| panic!("{e}"));
    native_tls::TlsAcceptor::new(identity).unwrap_or_else(|e| panic!("{e}"))
}
fn socket_pair() -> (TcpStream, std::thread::JoinHandle<TcpStream>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap_or_else(|e| panic!("{e}"));
    let address = listener.local_addr().unwrap_or_else(|e| panic!("{e}"));
    let task = std::thread::spawn(move || {
        let (stream, _) = listener.accept().unwrap_or_else(|e| panic!("{e}"));
        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
        stream
    });
    (
        TcpStream::connect(address).unwrap_or_else(|e| panic!("{e}")),
        task,
    )
}
fn read<S: Read + Write>(wire: &mut Wire<S>) -> String {
    wire.line().unwrap_or_else(|e| panic!("{e}"))
}
fn send<S: Read + Write>(wire: &mut Wire<S>, line: &str) {
    wire.send(line).unwrap_or_else(|e| panic!("{e}"));
}
fn authenticated<S: Read + Write>(wire: &mut Wire<S>, imap: bool, transcript: &mut Vec<String>) {
    let command = read(wire);
    transcript.push(command.clone());
    if imap {
        assert_eq!(command, "V003 CAPABILITY");
        send(wire, "* CAPABILITY IMAP4rev1 AUTH=PLAIN LOGINDISABLED");
        send(wire, "V003 OK capabilities");
    } else {
        assert_eq!(command, "EHLO mademail.invalid");
        send(wire, "250-fixture");
        send(wire, "250 AUTH PLAIN");
    }
    let command = read(wire);
    transcript.push(command.clone());
    assert_eq!(
        command,
        if imap {
            "V004 AUTHENTICATE PLAIN"
        } else {
            "AUTH PLAIN"
        }
    );
    send(wire, if imap { "+ " } else { "334 " });
    assert_eq!(read(wire), *payload("fixture-user", "fictional-password"));
    send(
        wire,
        if imap {
            "V004 OK authenticated"
        } else {
            "235 authenticated"
        },
    );
    transcript.push(read(wire));
}
#[test]
fn trusted_tls_and_starttls_authenticate_without_mailbox_or_delivery_commands() {
    for imap in [true, false] {
        for security in [Security::Tls, Security::StartTls] {
            let (client, accept) = socket_pair();
            let server = std::thread::spawn(move || {
                let stream = accept
                    .join()
                    .unwrap_or_else(|e| std::panic::resume_unwind(e));
                let mut transcript = vec![];
                let stream = if security == Security::StartTls {
                    let mut plain = Wire::new(stream);
                    send(
                        &mut plain,
                        if imap { "* OK fixture" } else { "220 fixture" },
                    );
                    transcript.push(read(&mut plain));
                    if imap {
                        send(&mut plain, "* CAPABILITY IMAP4rev1 STARTTLS");
                        send(&mut plain, "V003 OK capabilities");
                    } else {
                        send(&mut plain, "250-fixture");
                        send(&mut plain, "250 STARTTLS");
                    }
                    transcript.push(read(&mut plain));
                    send(
                        &mut plain,
                        if imap {
                            "V002 OK begin TLS"
                        } else {
                            "220 begin TLS"
                        },
                    );
                    plain.finish().unwrap_or_else(|e| panic!("{e}"))
                } else {
                    stream
                };
                let mut wire =
                    Wire::new(identity().accept(stream).unwrap_or_else(|e| panic!("{e}")));
                if security == Security::Tls {
                    send(&mut wire, if imap { "* OK fixture" } else { "220 fixture" });
                }
                authenticated(&mut wire, imap, &mut transcript);
                transcript
            });
            assert!(
                check_stream(
                    DeadlineStream::new(client, Instant::now() + Duration::from_secs(5)),
                    "localhost",
                    security,
                    "fixture-user",
                    "fictional-password",
                    imap,
                    &connector(true)
                )
                .is_ok()
            );
            let transcript = server
                .join()
                .unwrap_or_else(|e| std::panic::resume_unwind(e));
            assert!(transcript.iter().all(|line| !line.contains("FETCH")
                && !line.contains("SELECT")
                && !line.starts_with("MAIL ")
                && !line.starts_with("DATA")));
        }
    }
}
#[test]
fn missing_starttls_does_not_send_credentials() {
    for imap in [true, false] {
        let (client, accept) = socket_pair();
        let server = std::thread::spawn(move || {
            let mut wire = Wire::new(
                accept
                    .join()
                    .unwrap_or_else(|e| std::panic::resume_unwind(e)),
            );
            send(&mut wire, if imap { "* OK fixture" } else { "220 fixture" });
            let command = read(&mut wire);
            if imap {
                send(&mut wire, "* CAPABILITY IMAP4rev1 AUTH=PLAIN");
                send(&mut wire, "V003 OK capabilities");
            } else {
                send(&mut wire, "250 AUTH PLAIN");
            }
            let after = wire.line();
            (command, after)
        });
        assert!(
            check_stream(
                DeadlineStream::new(client, Instant::now() + Duration::from_secs(5)),
                "localhost",
                Security::StartTls,
                "fixture-user",
                "fictional-password",
                imap,
                &connector(true)
            )
            .is_err()
        );
        let (command, after) = server
            .join()
            .unwrap_or_else(|e| std::panic::resume_unwind(e));
        assert!(command == "V003 CAPABILITY" || command == "EHLO mademail.invalid");
        assert!(after.is_err());
    }
}
#[test]
fn invalid_certificate_and_hostname_refuse_authentication() {
    for (trusted, host) in [(false, "localhost"), (true, "wrong.invalid")] {
        let (client, accept) = socket_pair();
        let server = std::thread::spawn(move || {
            let socket = accept
                .join()
                .unwrap_or_else(|e| std::panic::resume_unwind(e));
            if let Ok(stream) = identity().accept(socket) {
                let mut wire = Wire::new(stream);
                let _ = wire.send("* OK fixture");
                assert!(wire.line().is_err());
            }
        });
        assert!(
            check_stream(
                DeadlineStream::new(client, Instant::now() + Duration::from_secs(5)),
                host,
                Security::Tls,
                "fixture-user",
                "fictional-password",
                true,
                &connector(trusted)
            )
            .is_err()
        );
        server
            .join()
            .unwrap_or_else(|e| std::panic::resume_unwind(e));
    }
}

#[test]
fn legacy_login_is_escaped_and_authentication_errors_do_not_echo_server_text() {
    let (mut wire, output) =
        memory("* CAPABILITY IMAP4rev1\r\nV003 OK ready\r\nV004 OK authenticated\r\n");
    assert!(imap_auth(&mut wire, "a\"b", "c\\d").is_ok());
    let sent = output.lock().unwrap_or_else(|e| panic!("{e}"));
    assert!(String::from_utf8_lossy(&sent).contains("LOGIN \"a\\\"b\" \"c\\\\d\""));
    let (mut wire, _) =
        memory("* CAPABILITY IMAP4rev1\r\nV003 OK ready\r\nV004 NO pretend-secret\r\n");
    assert!(
        !imap_auth(&mut wire, "user", "password")
            .err()
            .unwrap_or_default()
            .contains("pretend-secret")
    );
}
#[test]
fn expired_socket_deadlines_stop_before_any_io() {
    let (client, accepted) = socket_pair();
    let _server = accepted
        .join()
        .unwrap_or_else(|e| std::panic::resume_unwind(e));
    let mut socket = DeadlineStream::new(client, Instant::now() - Duration::from_millis(1));
    assert_eq!(
        socket.read(&mut [0]).err().map(|e| e.kind()),
        Some(std::io::ErrorKind::TimedOut)
    );
    assert_eq!(
        socket.write(b"credential").err().map(|e| e.kind()),
        Some(std::io::ErrorKind::TimedOut)
    );
}

#[test]
fn imap_capabilities_are_required_and_case_insensitive() {
    let (mut wire, _) = memory("* capability imap4rev1 logindisabled\r\nV003 ok capabilities\r\n");
    assert!(imap_auth(&mut wire, "user", "secret").is_err());
    let (mut wire, output) = memory("V003 OK no capabilities\r\n");
    assert!(imap_auth(&mut wire, "user", "secret").is_err());
    assert_eq!(
        *output.lock().unwrap_or_else(|e| panic!("{e}")),
        b"V003 CAPABILITY\r\n"
    );
}
