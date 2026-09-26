// File: programs/keyholder/src/parsers/squads_v4.rs
// [VERIFIED] — Squads v4 Multisig parser from https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/state/multisig.rs
// Discriminator: sha256("account:Multisig")[..8] = [74, 177, 248, 249, 84, 130, 63, 24]

use solana_program::pubkey::Pubkey;
use sha2::{Sha256, Digest};
use std::io::{Cursor, Read};

const SQUADS_V4_DISCRIMINATOR: &[u8] = &[74, 177, 248, 249, 84, 130, 63, 24];
const SQUADS_V4_PROGRAM_ID_BYTES: &[u8] = &[
    248, 150, 249, 26, 45, 107, 98, 235, 147, 40, 212, 30, 39, 173, 227, 233,
    184, 181, 28, 125, 176, 235, 206, 6, 60, 226, 200, 135, 145, 2, 96, 79,
];

#[derive(Clone, Debug)]
pub struct ParsedSquadsMultisig {
    pub create_key: Pubkey,
    pub config_authority: Pubkey,
    pub threshold: u16,
    pub time_lock: u32,
    pub transaction_index: u64,
    pub stale_transaction_index: u64,
    pub members_len: u32,
    pub members_hash: [u8; 32],
}

/// Parse Squads v4 Multisig account (Anchor Borsh format)
/// Offsets per size() and field definitions from Squads SDK
pub fn parse_squads_multisig(
    data: &[u8],
    owner: &Pubkey,
) -> Result<ParsedSquadsMultisig, Box<dyn std::error::Error>> {
    // Verify discriminator
    if data.len() < 8 || &data[0..8] != SQUADS_V4_DISCRIMINATOR {
        return Err("invalid Squads v4 discriminator".into());
    }

    // Verify owner is Squads v4 program
    let mut squads_id = [0u8; 32];
    squads_id.copy_from_slice(SQUADS_V4_PROGRAM_ID_BYTES);
    let expected_owner = Pubkey::new_from_array(squads_id);
    if owner != &expected_owner {
        return Err("account owner is not Squads v4 program".into());
    }

    if data.len() < 104 {
        return Err("data too short for Squads Multisig".into());
    }

    let mut cursor = Cursor::new(data);
    let mut buffer = [0u8; 8];
    cursor.read_exact(&mut buffer)?; // skip discriminator

    // create_key [8..40]
    let mut create_key_bytes = [0u8; 32];
    cursor.read_exact(&mut create_key_bytes)?;
    let create_key = Pubkey::new_from_array(create_key_bytes);

    // config_authority [40..72]
    let mut config_authority_bytes = [0u8; 32];
    cursor.read_exact(&mut config_authority_bytes)?;
    let config_authority = Pubkey::new_from_array(config_authority_bytes);

    // threshold [72..74]
    let mut threshold_bytes = [0u8; 2];
    cursor.read_exact(&mut threshold_bytes)?;
    let threshold = u16::from_le_bytes(threshold_bytes);

    // time_lock [74..78]
    let mut time_lock_bytes = [0u8; 4];
    cursor.read_exact(&mut time_lock_bytes)?;
    let time_lock = u32::from_le_bytes(time_lock_bytes);

    // transaction_index [78..86]
    let mut tx_index_bytes = [0u8; 8];
    cursor.read_exact(&mut tx_index_bytes)?;
    let transaction_index = u64::from_le_bytes(tx_index_bytes);

    // stale_transaction_index [86..94]
    let mut stale_index_bytes = [0u8; 8];
    cursor.read_exact(&mut stale_index_bytes)?;
    let stale_transaction_index = u64::from_le_bytes(stale_index_bytes);

    // rent_collector Option (Borsh format, 1 byte tag)
    let mut option_tag = [0u8];
    cursor.read_exact(&mut option_tag)?;
    if option_tag[0] != 0 && option_tag[0] != 1 {
        return Err("invalid Option tag for rent_collector".into());
    }

    if option_tag[0] == 1 {
        // Option::Some — skip the Pubkey (32 bytes)
        let mut _pubkey_bytes = [0u8; 32];
        cursor.read_exact(&mut _pubkey_bytes)?;
    }

    // bump [at 95 or after rent_collector]
    let pos = cursor.position() as usize;
    if pos >= data.len() {
        return Err("data too short to read bump".into());
    }

    // members start after bump
    let members_offset = pos + 1;
    if members_offset + 4 > data.len() {
        return Err("data too short for members len".into());
    }

    let mut members_len_bytes = [0u8; 4];
    members_len_bytes.copy_from_slice(&data[members_offset..members_offset + 4]);
    let members_len = u32::from_le_bytes(members_len_bytes);

    // Compute members hash for verification
    let members_data_start = members_offset + 4;
    let members_data_len = (members_len as usize) * 33; // 32 bytes key + 1 byte permissions
    if members_data_start + members_data_len > data.len() {
        return Err("data too short for members".into());
    }

    let members_hash = compute_members_hash(&data[members_data_start..members_data_start + members_data_len]);

    Ok(ParsedSquadsMultisig {
        create_key,
        config_authority,
        threshold,
        time_lock,
        transaction_index,
        stale_transaction_index,
        members_len,
        members_hash,
    })
}

fn compute_members_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_squads_multisig_valid() {
        // Create a minimal valid Squads account
        let mut squads_id = [0u8; 32];
        squads_id.copy_from_slice(SQUADS_V4_PROGRAM_ID_BYTES);
        let squads_program = Pubkey::new_from_array(squads_id);

        let mut data = Vec::new();
        // Discriminator
        data.extend_from_slice(SQUADS_V4_DISCRIMINATOR);
        // create_key (32 bytes)
        data.extend_from_slice(&[1u8; 32]);
        // config_authority (32 bytes)
        data.extend_from_slice(&[2u8; 32]);
        // threshold (u16, 2 bytes, little-endian)
        data.extend_from_slice(&(3u16).to_le_bytes());
        // time_lock (u32, 4 bytes, little-endian)
        data.extend_from_slice(&(86400u32).to_le_bytes());
        // transaction_index (u64, 8 bytes, little-endian)
        data.extend_from_slice(&(0u64).to_le_bytes());
        // stale_transaction_index (u64, 8 bytes, little-endian)
        data.extend_from_slice(&(0u64).to_le_bytes());
        // rent_collector Option::None (1 byte)
        data.push(0);
        // bump (1 byte)
        data.push(255);
        // members count (u32, 4 bytes, little-endian) = 0
        data.extend_from_slice(&(0u32).to_le_bytes());
        // Ensure we have at least 104 bytes
        while data.len() < 104 {
            data.push(0);
        }

        let result = parse_squads_multisig(&data, &squads_program).unwrap();
        assert_eq!(result.threshold, 3);
        assert_eq!(result.time_lock, 86400);
        assert_eq!(result.members_len, 0);
    }

    #[test]
    fn test_parse_squads_multisig_invalid_discriminator() {
        let mut squads_id = [0u8; 32];
        squads_id.copy_from_slice(SQUADS_V4_PROGRAM_ID_BYTES);
        let squads_program = Pubkey::new_from_array(squads_id);

        let mut data = vec![0u8; 104];
        data[0..8].copy_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0]); // wrong discriminator

        let result = parse_squads_multisig(&data, &squads_program);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_squads_multisig_short_data() {
        let mut squads_id = [0u8; 32];
        squads_id.copy_from_slice(SQUADS_V4_PROGRAM_ID_BYTES);
        let squads_program = Pubkey::new_from_array(squads_id);
        let data = vec![1, 2, 3];

        let result = parse_squads_multisig(&data, &squads_program);
        assert!(result.is_err());
    }
}
