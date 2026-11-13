use std::{
    io::{self, Read, Write},
    net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs},
    sync::{
        atomic::{AtomicUsize, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
static RESOLVERS: AtomicUsize = AtomicUsize::new(0);
pub fn public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !matches!(a, 0 | 10 | 127 | 224..=255)
                && !(a == 100 && (64..=127).contains(&b))
                && !(a == 169 && b == 254)
                && !(a == 172 && (16..=31).contains(&b))
                && !(a == 192 && (b == 168 || (b == 0 && (c == 0 || c == 2))))
                && !(a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
                && !(a == 203 && b == 0 && c == 113)
        }
        IpAddr::V6(ip) => {
            let s = ip.segments();
            s[0] & 0xe000 == 0x2000
                && s[0] != 0x2002
                && s[0] != 0x3fff
                && !(s[0] == 0x2001 && (s[1] < 0x200 || s[1] == 0xdb8))
        }
    }
}
pub fn resolve(host: &str, port: u16) -> Result<Vec<SocketAddr>, &'static str> {
    if RESOLVERS
        .try_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
            (n < 2).then_some(n + 1)
        })
        .is_err()
    {
        return Err("DNS is still busy. Try again later.");
    }
    let (tx, rx) = mpsc::channel();
    let host = host.to_owned();
    std::thread::spawn(move || {
        struct Permit;
        impl Drop for Permit {
            fn drop(&mut self) {
                RESOLVERS.fetch_sub(1, Ordering::SeqCst);
            }
        }
        let _permit = Permit;
        let result = (host.as_str(), port)
            .to_socket_addrs()
            .map(|r| r.take(33).collect::<Vec<_>>());
        let _ = tx.send(result);
    });
    let addresses = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "Server DNS lookup timed out.")?
        .map_err(|_| "Could not resolve the server hostname.")?;
    validate_addresses(addresses)
}
fn validate_addresses(addresses: Vec<SocketAddr>) -> Result<Vec<SocketAddr>, &'static str> {
    if addresses.is_empty()
        || addresses.len() > 32
        || addresses.iter().any(|a| !public_address(a.ip()))
    {
        return Err(
            "Use a public mail server. Private, local and special-use addresses are refused.",
        );
    }
    Ok(addresses)
}
pub struct DeadlineStream {
    socket: TcpStream,
    deadline: Instant,
}
impl DeadlineStream {
    pub fn new(socket: TcpStream, deadline: Instant) -> Self {
        Self { socket, deadline }
    }
    pub fn connect(addresses: Vec<SocketAddr>, deadline: Instant) -> Result<Self, &'static str> {
        for address in addresses.into_iter().take(4) {
            let remaining = deadline
                .saturating_duration_since(Instant::now())
                .min(Duration::from_secs(5));
            if remaining.is_zero() {
                break;
            }
            if let Ok(socket) = TcpStream::connect_timeout(&address, remaining) {
                return Ok(Self::new(socket, deadline));
            }
        }
        Err("Could not connect to the mail server within the time limit.")
    }
    fn remaining(&self) -> io::Result<Duration> {
        let remaining = self.deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "operation deadline",
            ))
        } else {
            Ok(remaining.min(Duration::from_secs(5)))
        }
    }
}
impl Read for DeadlineStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.socket.set_read_timeout(Some(self.remaining()?))?;
        self.socket.read(buf)
    }
}
impl Write for DeadlineStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.socket.set_write_timeout(Some(self.remaining()?))?;
        self.socket.write(buf)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.socket.set_write_timeout(Some(self.remaining()?))?;
        self.socket.flush()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_private_documentation_and_transition_addresses() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "192.168.0.1",
            "192.0.2.1",
            "198.51.100.2",
            "203.0.113.1",
            "224.0.0.1",
            "::1",
            "::ffff:8.8.8.8",
            "2001:db8::1",
            "2002:0808:0808::1",
            "fc00::1",
            "fe80::1",
            "3fff::1",
        ] {
            assert!(
                !public_address(ip.parse().unwrap_or_else(|e| panic!("{e}"))),
                "{ip}"
            );
        }
        for ip in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
            assert!(public_address(ip.parse().unwrap_or_else(|e| panic!("{e}"))));
        }
    }
}

#[cfg(test)]
mod resolution_tests {
    use super::*;
    #[test]
    fn mixed_dns_answers_are_refused_as_a_set() {
        let public = SocketAddr::from(([8, 8, 8, 8], 993));
        let private = SocketAddr::from(([127, 0, 0, 1], 993));
        assert!(validate_addresses(vec![public, private]).is_err());
        assert!(validate_addresses(vec![]).is_err());
        assert!(validate_addresses(vec![public; 33]).is_err());
        assert_eq!(validate_addresses(vec![public]), Ok(vec![public]));
    }
}
