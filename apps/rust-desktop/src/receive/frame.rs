//! IMAP response framing: bound bytes and grammar depth before the parser runs.
use std::io::BufRead;
pub(super) const MAX_FRAME: usize = 1_100_000;
pub(super) fn frame(reader: &mut impl BufRead) -> Result<Vec<u8>, &'static str> {
    let mut result = Vec::new();
    let mut depth = 0_u8;
    let mut quoted = false;
    let mut escape = false;
    loop {
        let mut line = Vec::new();
        loop {
            let data = reader.fill_buf().map_err(|_| "Mail response timed out.")?;
            if data.is_empty() {
                return Err("Mail response was truncated.");
            }
            let n = data
                .iter()
                .position(|b| *b == b'\n')
                .map_or(data.len(), |n| n + 1);
            if line.len() + n > 8192 || result.len() + line.len() + n > MAX_FRAME {
                return Err("Mail response exceeded the safety limit.");
            }
            line.extend_from_slice(&data[..n]);
            reader.consume(n);
            if line.ends_with(b"\n") {
                break;
            }
        }
        if !line.ends_with(b"\r\n") || line.contains(&0) {
            return Err("Invalid mail response framing.");
        }
        // Status information is free text, not recursive IMAP grammar or a literal.
        if result.is_empty() {
            let upper = String::from_utf8_lossy(&line).to_ascii_uppercase();
            let mut words = upper.split_whitespace();
            let first = words.next();
            let second = words.next();
            if first.is_some_and(|tag| tag == "*" || tag == "R001")
                && second
                    .is_some_and(|status| matches!(status, "OK" | "NO" | "BAD" | "BYE" | "PREAUTH"))
            {
                return Ok(line);
            }
        }
        for b in &line[..line.len() - 2] {
            if escape {
                escape = false;
                continue;
            }
            if quoted && *b == b'\\' {
                escape = true;
                continue;
            }
            if *b == b'"' {
                quoted = !quoted;
                continue;
            }
            if !quoted {
                if *b == b'(' {
                    depth = depth
                        .checked_add(1)
                        .filter(|n| *n <= 32)
                        .ok_or("Mail response nesting exceeded the safety limit.")?;
                } else if *b == b')' {
                    depth = depth
                        .checked_sub(1)
                        .ok_or("Invalid mail response nesting.")?;
                }
            }
        }
        let content = &line[..line.len() - 2];
        let literal = if !quoted && content.ends_with(b"}") {
            let start = content
                .iter()
                .rposition(|b| *b == b'{')
                .ok_or("Invalid mail literal.")?;
            let number = &content[start + 1..content.len() - 1];
            if number.is_empty() || !number.iter().all(u8::is_ascii_digit) {
                return Err("Invalid mail literal length.");
            }
            Some(
                std::str::from_utf8(number)
                    .ok()
                    .and_then(|s| s.parse::<usize>().ok())
                    .ok_or("Invalid mail literal length.")?,
            )
        } else {
            None
        };
        result.extend_from_slice(&line);
        if let Some(n) = literal {
            if n > MAX_FRAME - result.len() {
                return Err("Mail literal exceeded the safety limit.");
            }
            let start = result.len();
            result.resize(start + n, 0);
            reader
                .read_exact(&mut result[start..])
                .map_err(|_| "Mail literal was truncated.")?;
        } else {
            if quoted || depth != 0 {
                return Err("Incomplete mail response grammar.");
            }
            return Ok(result);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    #[test]
    fn literals_are_opaque_and_framing_stops_at_one_response() {
        let bytes = b"* 1 FETCH (BODY[] {5}\r\n(\r\n)) UID 9)\r\nR OK done\r\n";
        let mut reader = Cursor::new(bytes);
        let first = frame(&mut reader).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(first, b"* 1 FETCH (BODY[] {5}\r\n(\r\n)) UID 9)\r\n");
        assert_eq!(
            frame(&mut reader).unwrap_or_else(|e| panic!("{e}")),
            b"R OK done\r\n"
        );
    }
    #[test]
    fn hostile_lengths_depth_and_truncation_are_refused() {
        for data in [
            b"* 1 FETCH (BODY[] {4294967295}\r\n".to_vec(),
            format!("* 1 FETCH ({}\r\n", "(".repeat(40)).into_bytes(),
            b"* 1 FETCH (BODY[] {10}\r\nshort".to_vec(),
            b"* OK broken\n".to_vec(),
            vec![b'x'; 8193],
        ] {
            assert!(frame(&mut Cursor::new(data)).is_err());
        }
    }
    #[test]
    fn status_information_is_not_mistaken_for_structured_data() {
        let line = b"R001 OK server says unmatched ( \" and {999999999}\r\n";
        assert_eq!(
            frame(&mut Cursor::new(line)).unwrap_or_else(|e| panic!("{e}")),
            line
        );
    }
}
