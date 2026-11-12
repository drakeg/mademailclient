use made_mail_core::MessageKey;

#[derive(Clone, Copy)]
pub enum Step {
    Previous,
    Next,
    First,
    Last,
}

pub fn destination(keys: &[MessageKey], current: &MessageKey, step: Step) -> Option<MessageKey> {
    let index = keys.iter().position(|key| key == current)?;
    let target = match step {
        Step::Previous => index.saturating_sub(1),
        Step::Next => (index + 1).min(keys.len() - 1),
        Step::First => 0,
        Step::Last => keys.len() - 1,
    };
    keys.get(target).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn keys() -> Vec<MessageKey> {
        ["account-a", "account-b"]
            .map(|account| MessageKey {
                account: account.into(),
                id: 1,
            })
            .into()
    }
    #[test]
    fn arrows_respect_order_and_stop_at_edges() {
        let keys = keys();
        assert_eq!(
            destination(&keys, &keys[0], Step::Next),
            Some(keys[1].clone())
        );
        assert_eq!(
            destination(&keys, &keys[1], Step::Previous),
            Some(keys[0].clone())
        );
        assert_eq!(
            destination(&keys, &keys[1], Step::Next),
            Some(keys[1].clone())
        );
        assert_eq!(
            destination(&keys, &keys[0], Step::Previous),
            Some(keys[0].clone())
        );
    }
    #[test]
    fn home_end_and_removed_rows_cannot_cross_scope() {
        let keys = keys();
        assert_eq!(
            destination(&keys, &keys[0], Step::Last),
            Some(keys[1].clone())
        );
        assert_eq!(
            destination(&keys, &keys[1], Step::First),
            Some(keys[0].clone())
        );
        assert_eq!(destination(&keys[..1], &keys[1], Step::Next), None);
        assert_eq!(destination(&[], &keys[0], Step::First), None);
    }
}
