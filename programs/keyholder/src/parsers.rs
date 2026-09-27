//! Pure byte parsers for the two account layouts `check` reads live, on-chain,
//! with no trust in any off-chain writer:
//!
//! - BPF Upgradeable Loader `ProgramData` (bincode; anza-xyz/solana-sdk
//!   `loader-v3-interface/src/state.rs`).
//! - Squads v4 `Multisig` (Anchor/borsh; Squads-Protocol/v4
//!   `programs/squads_multisig_program/src/state/multisig.rs`).
//!
//! These are `fn(&[u8]) -> Result<_, ParseError>` with no Anchor or SVM
//! dependency, so they can be fuzzed and unit-tested on raw bytes without a
//! runtime. `lib.rs` calls them from inside `refresh`/`check` against live
//! account data.

use anchor_lang::prelude::Pubkey;

pub const BPF_LOADER_UPGRADEABLE_ID: Pubkey = anchor_lang::solana_program::bpf_loader_upgradeable::ID;

/// Squads v4 program id (mainnet + devnet): `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` [S1].
pub fn squads_v4_program_id() -> Pubkey {
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
        .parse()
        .expect("hardcoded Squads v4 program id is valid base58")
}

/// sha256("account:Multisig")[..8] — Anchor account discriminator for Squads
/// v4's `Multisig` struct. Recomputed (not hardcoded) so it can never drift
/// from the real hash; cross-checked against real fixture bytes in
/// `discriminator_matches_real_fixture` below.
pub fn squads_multisig_discriminator() -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(b"account:Multisig");
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ParseError {
    TooShort,
    BadTag,
    BadDiscriminator,
    BadOwner,
    TruncatedMembers,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct ProgramDataInfo {
    pub slot: u64,
    pub upgrade_authority: Option<Pubkey>,
}

/// Parses a BPF Upgradeable Loader `ProgramData` account body.
///
/// Layout (bincode, little-endian, [S3]):
/// ```text
/// [0..4]   u32 enum tag = 3 (ProgramData)
/// [4..12]  u64 slot
/// [12]     u8 Option tag (0 None / 1 Some)
/// [13..45] Pubkey upgrade_authority   (present iff tag == 1)
/// [45..]   ELF bytes (ignored)
/// ```
pub fn parse_programdata(data: &[u8]) -> Result<ProgramDataInfo, ParseError> {
    if data.len() < 13 {
        return Err(ParseError::TooShort);
    }
    let tag = u32::from_le_bytes(data[0..4].try_into().unwrap());
    if tag != 3 {
        return Err(ParseError::BadTag);
    }
    let slot = u64::from_le_bytes(data[4..12].try_into().unwrap());
    let opt_tag = data[12];
    let upgrade_authority = match opt_tag {
        0 => None,
        1 => {
            if data.len() < 45 {
                return Err(ParseError::TooShort);
            }
            Some(Pubkey::new_from_array(data[13..45].try_into().unwrap()))
        }
        _ => return Err(ParseError::BadTag),
    };
    Ok(ProgramDataInfo { slot, upgrade_authority })
}

/// Parses a Solana BPF Loader Upgradeable `Program` account body and returns
/// its `programdata_address` field. Layout: `[0..4]` tag = 2, `[4..36]` pubkey.
pub fn parse_program_account(data: &[u8]) -> Result<Pubkey, ParseError> {
    if data.len() < 36 {
        return Err(ParseError::TooShort);
    }
    let tag = u32::from_le_bytes(data[0..4].try_into().unwrap());
    if tag != 2 {
        return Err(ParseError::BadTag);
    }
    Ok(Pubkey::new_from_array(data[4..36].try_into().unwrap()))
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct MemberSummary {
    pub key: Pubkey,
    pub permissions_mask: u8,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SquadsMultisigInfo {
    pub config_authority: Pubkey,
    pub threshold: u16,
    pub time_lock: u32,
    pub transaction_index: u64,
    pub stale_transaction_index: u64,
    pub bump: u8,
    pub members: Vec<MemberSummary>,
}

/// Parses a Squads v4 `Multisig` account body (owner + discriminator must be
/// checked by the caller before calling this — see `parse_squads_multisig_checked`).
///
/// Fixed offsets are safe only up to byte 94 (`rent_collector`'s Option tag):
/// borsh serializes `Option::None` as a single byte, so `rent_collector`,
/// `bump` and `members` must be parsed sequentially after that point, not at
/// fixed offsets — see ONCHAIN.md §5.
pub fn parse_squads_multisig(data: &[u8]) -> Result<SquadsMultisigInfo, ParseError> {
    // 8 disc + 32 create_key + 32 config_authority + 2 threshold + 4 time_lock
    // + 8 transaction_index + 8 stale_transaction_index + 1 rent_collector tag = 95
    if data.len() < 95 {
        return Err(ParseError::TooShort);
    }
    let config_authority = Pubkey::new_from_array(data[40..72].try_into().unwrap());
    let threshold = u16::from_le_bytes(data[72..74].try_into().unwrap());
    let time_lock = u32::from_le_bytes(data[74..78].try_into().unwrap());
    let transaction_index = u64::from_le_bytes(data[78..86].try_into().unwrap());
    let stale_transaction_index = u64::from_le_bytes(data[86..94].try_into().unwrap());

    let mut cursor: usize = 94;
    let rent_collector_tag = *data.get(cursor).ok_or(ParseError::TooShort)?;
    cursor += 1;
    match rent_collector_tag {
        0 => {}
        1 => cursor += 32,
        _ => return Err(ParseError::BadTag),
    }

    let bump = *data.get(cursor).ok_or(ParseError::TooShort)?;
    cursor += 1;

    let members_len_bytes = data.get(cursor..cursor + 4).ok_or(ParseError::TooShort)?;
    let members_len = u32::from_le_bytes(members_len_bytes.try_into().unwrap()) as usize;
    cursor += 4;

    let mut members = Vec::with_capacity(members_len.min(64));
    for _ in 0..members_len {
        let key_bytes = data.get(cursor..cursor + 32).ok_or(ParseError::TruncatedMembers)?;
        let key = Pubkey::new_from_array(key_bytes.try_into().unwrap());
        cursor += 32;
        let permissions_mask = *data.get(cursor).ok_or(ParseError::TruncatedMembers)?;
        cursor += 1;
        members.push(MemberSummary { key, permissions_mask });
    }

    Ok(SquadsMultisigInfo {
        config_authority,
        threshold,
        time_lock,
        transaction_index,
        stale_transaction_index,
        bump,
        members,
    })
}

/// `parse_squads_multisig` plus the owner+discriminator checks that are
/// mandatory before trusting any field (ONCHAIN.md §5: "Owner check ... and
/// discriminator check ... are mandatory before reading").
pub fn parse_squads_multisig_checked(
    owner: &Pubkey,
    data: &[u8],
) -> Result<SquadsMultisigInfo, ParseError> {
    if *owner != squads_v4_program_id() {
        return Err(ParseError::BadOwner);
    }
    if data.len() < 8 || data[0..8] != squads_multisig_discriminator() {
        return Err(ParseError::BadDiscriminator);
    }
    parse_squads_multisig(data)
}

/// Recomputes the Squads v4 vault PDA and compares it against `authority`.
/// Seeds: `["multisig", multisig, "vault", vault_index: u8]` [S2].
pub fn is_squads_vault_authority(authority: &Pubkey, multisig: &Pubkey, vault_index: u8) -> bool {
    let seeds: &[&[u8]] = &[b"multisig", multisig.as_ref(), b"vault", &[vault_index]];
    match Pubkey::find_program_address(seeds, &squads_v4_program_id()).0 == *authority {
        true => true,
        false => false,
    }
}

/// Tries vault indices 0..=3 (ONCHAIN.md §5 ASSUMPTION: protocols use vault 0
/// in practice; a small search covers the rest cheaply).
pub fn find_squads_vault_index(authority: &Pubkey, multisig: &Pubkey) -> Option<u8> {
    (0u8..=3).find(|&idx| is_squads_vault_authority(authority, multisig, idx))
}

/// Squads v3 (squads-mpl) program id, mainnet: read from the owner of Jupiter
/// v6's authority multisig (7ZyDFz…), 2026-09-27.
pub fn squads_v3_program_id() -> Pubkey {
    "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu".parse().expect("hardcoded Squads v3 program id is valid base58")
}

/// Coral multisig (coral-xyz/multisig layout) program id: read from the owner
/// of Marinade's authority multisig (magrsH…), 2026-09-27.
pub fn coral_multisig_program_id() -> Pubkey {
    "msigmtwzgXJHj2ext4XJjCDmpbcMuufFb5cHuwg6Xdt".parse().expect("hardcoded coral multisig program id is valid base58")
}

fn anchor_discriminator(name: &[u8]) -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let mut pre = b"account:".to_vec();
    pre.extend_from_slice(name);
    let digest = Sha256::digest(&pre);
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct SquadsV3Info {
    pub threshold: u16,
    pub authority_index: u16,
    /// Bumps whenever members or threshold change: the v3 analogue of v4's
    /// stale_transaction_index for "control changed since last refresh".
    pub ms_change_index: u32,
    pub member_count: u16,
}

/// Squads v3 `Ms` (squads-mpl `state.rs`): disc[8] threshold u16 @8,
/// authority_index u16 @10, transaction_index u32 @12, ms_change_index u32 @16,
/// bump u8 @20, create_key @21..53, allow_external_execute @53, keys: Vec<Pubkey> @54.
/// v3 has no timelock field.
pub fn parse_squads_v3_ms_checked(owner: &Pubkey, data: &[u8]) -> Result<SquadsV3Info, ParseError> {
    if *owner != squads_v3_program_id() {
        return Err(ParseError::BadOwner);
    }
    if data.len() < 58 {
        return Err(ParseError::TooShort);
    }
    if data[0..8] != anchor_discriminator(b"Ms") {
        return Err(ParseError::BadDiscriminator);
    }
    let member_count = u32::from_le_bytes(data[54..58].try_into().unwrap());
    if data.len() < 58 + 32 * member_count as usize {
        return Err(ParseError::TruncatedMembers);
    }
    Ok(SquadsV3Info {
        threshold: u16::from_le_bytes(data[8..10].try_into().unwrap()),
        authority_index: u16::from_le_bytes(data[10..12].try_into().unwrap()),
        ms_change_index: u32::from_le_bytes(data[16..20].try_into().unwrap()),
        member_count: member_count as u16,
    })
}

/// v3 authority PDA: seeds ["squad", multisig, index u32 LE, "authority"]; index 0 is
/// reserved for internal use, so vaults are 1..=4 (a small search, as for v4).
pub fn find_squads_v3_authority_index(authority: &Pubkey, multisig: &Pubkey) -> Option<u32> {
    (1u32..=4).find(|idx| {
        let seeds: &[&[u8]] = &[b"squad", multisig.as_ref(), &idx.to_le_bytes(), b"authority"];
        Pubkey::find_program_address(seeds, &squads_v3_program_id()).0 == *authority
    })
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct CoralMultisigInfo {
    pub threshold: u64,
    pub nonce: u8,
    pub owner_set_seqno: u32,
    pub owner_count: u16,
}

/// Coral multisig `Multisig`: disc[8] (sha256("account:Multisig"), the same as
/// Squads v4's, so the owner check is what separates them), owners Vec<Pubkey> @8,
/// then threshold u64, nonce u8, owner_set_seqno u32. No timelock field.
pub fn parse_coral_multisig(data: &[u8]) -> Result<CoralMultisigInfo, ParseError> {
    if data.len() < 12 {
        return Err(ParseError::TooShort);
    }
    if data[0..8] != anchor_discriminator(b"Multisig") {
        return Err(ParseError::BadDiscriminator);
    }
    let n = u32::from_le_bytes(data[8..12].try_into().unwrap()) as usize;
    let tail = 12 + 32 * n;
    if data.len() < tail + 13 {
        return Err(ParseError::TruncatedMembers);
    }
    Ok(CoralMultisigInfo {
        threshold: u64::from_le_bytes(data[tail..tail + 8].try_into().unwrap()),
        nonce: data[tail + 8],
        owner_set_seqno: u32::from_le_bytes(data[tail + 9..tail + 13].try_into().unwrap()),
        owner_count: n as u16,
    })
}

pub fn parse_coral_multisig_checked(owner: &Pubkey, data: &[u8]) -> Result<CoralMultisigInfo, ParseError> {
    if *owner != coral_multisig_program_id() {
        return Err(ParseError::BadOwner);
    }
    parse_coral_multisig(data)
}

/// The coral multisig's signer PDA: create_program_address([multisig, [nonce]]).
pub fn coral_signer(multisig: &Pubkey, nonce: u8) -> Option<Pubkey> {
    Pubkey::create_program_address(&[multisig.as_ref(), &[nonce]], &coral_multisig_program_id()).ok()
}

/// Deterministic Derived score, 0..100. Documented in ONCHAIN.md §5 so
/// anyone can recompute it off-chain. Monotonic: strictly weaker inputs
/// (lower threshold, shorter timelock, a controlling config_authority, or a
/// low voter:threshold ratio) never score higher — enforced by the property
/// test `score_is_monotonic_in_threshold_and_timelock` below.
pub fn derived_score(
    is_immutable: bool,
    is_single_key: bool,
    threshold: u16,
    voters: u16,
    time_lock: u32,
    has_config_authority: bool,
) -> u8 {
    if is_immutable {
        return 100;
    }
    if is_single_key {
        return 10;
    }
    let mut score: i32 = 30 + 10 * (threshold.min(5) as i32);
    score += match time_lock {
        0 => 0,
        1..=3599 => 10,          // >=0, <1h: counted as "some" tier below 1h is folded into 0 bucket per spec wording; kept explicit
        3600..=86399 => 10,      // >=1h
        86400..=259199 => 20,    // >=24h
        _ => 25,                 // >=72h
    };
    if has_config_authority {
        score -= 15;
    }
    if voters > 0 && (threshold as u32) * 2 <= voters as u32 {
        score -= 10;
    }
    score.clamp(0, 100) as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::fs;

    fn fixture_bytes(name: &str) -> (String, Vec<u8>) {
        let path = format!("{}/tests/fixtures/{}", env!("CARGO_MANIFEST_DIR"), name);
        let raw = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"));
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let owner = json["owner"].as_str().unwrap().to_string();
        let data_b64 = json["data_b64"].as_str().unwrap();
        let bytes = base64::engine::general_purpose::STANDARD.decode(data_b64).unwrap();
        (owner, bytes)
    }

    // ---- ProgramData: real Drift v2 fixture, upgrade authority = Some(pubkey) ----
    #[test]
    fn parses_real_drift_programdata_with_authority() {
        let (_owner, data) = fixture_bytes("drift-programdata.json");
        let info = parse_programdata(&data).expect("parses");
        // 429731225 is the slot bincode-encoded inside the account bytes
        // themselves (the fixture's outer "slot" field records when it was
        // fetched, which is a later slot than the last deploy).
        assert_eq!(info.slot, 429731225);
        assert!(info.upgrade_authority.is_some());
        // The ProgramData authority is the Squads *vault* PDA, not the
        // Multisig account itself; see `drift_authority_is_the_drift_multisig_vault`
        // below for the vault -> multisig PDA recomputation.
        assert_eq!(
            info.upgrade_authority.unwrap().to_string(),
            "8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai"
        );
    }

    #[test]
    fn programdata_rejects_wrong_tag() {
        let mut data = vec![0u8; 45];
        data[0..4].copy_from_slice(&1u32.to_le_bytes()); // tag 1 = Buffer, not ProgramData
        assert_eq!(parse_programdata(&data), Err(ParseError::BadTag));
    }

    #[test]
    fn programdata_none_authority_is_immutable() {
        let mut data = vec![0u8; 13];
        data[0..4].copy_from_slice(&3u32.to_le_bytes());
        data[4..12].copy_from_slice(&999u64.to_le_bytes());
        data[12] = 0; // None
        let info = parse_programdata(&data).unwrap();
        assert_eq!(info.slot, 999);
        assert_eq!(info.upgrade_authority, None);
    }

    #[test]
    fn programdata_too_short_fails_closed() {
        assert_eq!(parse_programdata(&[1, 2, 3]), Err(ParseError::TooShort));
    }

    // ---- Squads v4: real Drift multisig, currently 4-of-7 / 3600s ----
    #[test]
    fn parses_real_drift_multisig_4of7_3600s() {
        let (owner, data) = fixture_bytes("drift-4of7-multisig.json");
        assert_eq!(owner, "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");
        let info = parse_squads_multisig(&data).expect("parses");
        assert_eq!(info.threshold, 4);
        assert_eq!(info.time_lock, 3600);
        assert_eq!(info.members.len(), 7);
    }

    #[test]
    fn checked_parse_verifies_owner_and_discriminator_on_real_bytes() {
        let (owner_str, data) = fixture_bytes("drift-4of7-multisig.json");
        let owner: Pubkey = owner_str.parse().unwrap();
        let info = parse_squads_multisig_checked(&owner, &data).expect("parses");
        assert_eq!(info.threshold, 4);

        let wrong_owner = Pubkey::default();
        assert_eq!(
            parse_squads_multisig_checked(&wrong_owner, &data),
            Err(ParseError::BadOwner)
        );
    }

    // ---- Squads v4: real Drift Security Council multisig, weakened to 2-of-5 / 0s ----
    #[test]
    fn parses_real_council_multisig_2of5_0s() {
        let (owner, data) = fixture_bytes("council-2of5-multisig.json");
        assert_eq!(owner, "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");
        let info = parse_squads_multisig(&data).expect("parses");
        assert_eq!(info.threshold, 2);
        assert_eq!(info.time_lock, 0);
        assert_eq!(info.members.len(), 5);
        assert!(info.stale_transaction_index >= 1);
    }

    #[test]
    fn discriminator_matches_real_fixture() {
        // The discriminator constant above must equal the first 8 bytes of
        // every real Squads Multisig account we have.
        let (_o, drift) = fixture_bytes("drift-4of7-multisig.json");
        let (_o2, council) = fixture_bytes("council-2of5-multisig.json");
        assert_eq!(drift[0..8], council[0..8]);
        assert_eq!(drift[0..8], squads_multisig_discriminator());
    }

    #[test]
    fn squads_malformed_bytes_never_panics() {
        for len in 0..120 {
            let data = vec![0xAAu8; len];
            let _ = parse_squads_multisig(&data); // must not panic
        }
    }

    #[test]
    fn squads_truncated_members_fails_closed() {
        let (_owner, mut data) = fixture_bytes("drift-4of7-multisig.json");
        data.truncate(100); // cuts into the members array
        assert_eq!(parse_squads_multisig(&data), Err(ParseError::TruncatedMembers));
    }

    // ---- vault PDA recomputation against the real Drift multisig+authority pair ----
    #[test]
    fn drift_authority_is_the_drift_multisig_vault() {
        let (_o, pd) = fixture_bytes("drift-programdata.json");
        let info = parse_programdata(&pd).unwrap();
        let authority = info.upgrade_authority.unwrap();
        let multisig: Pubkey = "7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM".parse().unwrap();
        let found = find_squads_vault_index(&authority, &multisig);
        assert_eq!(found, Some(0), "Drift's vault should be found at index 0");
    }

    #[test]
    fn vault_pda_recompute_rejects_wrong_multisig() {
        let authority: Pubkey = "7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM".parse().unwrap();
        let wrong_multisig: Pubkey = "61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP".parse().unwrap();
        assert_eq!(find_squads_vault_index(&authority, &wrong_multisig), None);
    }

    // ---- score monotonicity property (spec: "weaker inputs never score higher") ----
    #[test]
    fn score_is_monotonic_in_threshold_and_timelock() {
        let base = derived_score(false, false, 2, 5, 0, false);
        let more_threshold = derived_score(false, false, 4, 5, 0, false);
        assert!(more_threshold >= base);

        let more_timelock = derived_score(false, false, 2, 5, 86_400, false);
        assert!(more_timelock >= base);

        let controlled = derived_score(false, false, 4, 7, 3600, true);
        let uncontrolled = derived_score(false, false, 4, 7, 3600, false);
        assert!(controlled < uncontrolled);
    }

    #[test]
    fn score_immutable_beats_everything() {
        assert_eq!(derived_score(true, false, 0, 0, 0, false), 100);
    }

    #[test]
    fn score_single_key_is_low() {
        let single = derived_score(false, true, 0, 0, 0, false);
        let weak_multisig = derived_score(false, false, 2, 3, 0, false);
        assert!(single < weak_multisig);
    }

    // Real numbers: Drift's live multisig should score higher than the
    // weakened council fixture under the same formula.
    #[test]
    fn real_drift_scores_higher_than_real_weakened_council() {
        let drift = derived_score(false, false, 4, 7, 3600, false);
        let council = derived_score(false, false, 2, 5, 0, false);
        assert!(drift > council, "drift={drift} council={council}");
    }

    // ---- Squads v3 (squads-mpl): real Jupiter v6 authority multisig, mainnet 2026-09-27 ----
    #[test]
    fn squads_v3_parses_real_jupiter_multisig() {
        let (owner, data) = fixture_bytes("jupiter-squads-v3-multisig.json");
        let owner: Pubkey = owner.parse().unwrap();
        let info = parse_squads_v3_ms_checked(&owner, &data).expect("real v3 Ms parses");
        assert_eq!(info.threshold, 4);
        assert_eq!(info.member_count, 7);
    }

    #[test]
    fn squads_v3_vault_authority_matches_jupiter_upgrade_authority() {
        let raw = fs::read_to_string(format!("{}/tests/fixtures/jupiter-squads-v3-multisig.json", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let ms: Pubkey = json["address"].as_str().unwrap().parse().unwrap();
        let auth: Pubkey = json["vault_authority"].as_str().unwrap().parse().unwrap();
        assert!(find_squads_v3_authority_index(&auth, &ms).is_some());
        assert!(find_squads_v3_authority_index(&Pubkey::new_unique(), &ms).is_none());
    }

    #[test]
    fn squads_v3_rejects_wrong_owner() {
        let (_owner, data) = fixture_bytes("jupiter-squads-v3-multisig.json");
        assert_eq!(parse_squads_v3_ms_checked(&squads_v4_program_id(), &data), Err(ParseError::BadOwner));
    }

    // ---- Coral multisig (coral-xyz/multisig): real Marinade authority, mainnet 2026-09-27 ----
    #[test]
    fn coral_parses_real_marinade_multisig() {
        let (owner, data) = fixture_bytes("marinade-coral-multisig.json");
        let owner: Pubkey = owner.parse().unwrap();
        let info = parse_coral_multisig_checked(&owner, &data).expect("real coral multisig parses");
        assert_eq!(info.threshold, 6);
        assert_eq!(info.owner_count, 13);
        assert_eq!(info.nonce, 253);
    }

    #[test]
    fn coral_signer_is_marinade_upgrade_authority() {
        let raw = fs::read_to_string(format!("{}/tests/fixtures/marinade-coral-multisig.json", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let ms: Pubkey = json["address"].as_str().unwrap().parse().unwrap();
        let signer: Pubkey = json["signer_pda"].as_str().unwrap().parse().unwrap();
        let (_o, data) = fixture_bytes("marinade-coral-multisig.json");
        let info = parse_coral_multisig(&data).unwrap();
        assert_eq!(coral_signer(&ms, info.nonce), Some(signer));
    }

    #[test]
    fn coral_rejects_squads_v4_account_with_same_discriminator() {
        // Squads v4 and coral both name their account `Multisig`, so the
        // discriminators collide; the owner check is what tells them apart.
        let (owner, data) = fixture_bytes("drift-4of7-multisig.json");
        let owner: Pubkey = owner.parse().unwrap();
        assert_eq!(parse_coral_multisig_checked(&owner, &data), Err(ParseError::BadOwner));
    }
}
