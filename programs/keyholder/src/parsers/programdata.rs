// File: programs/keyholder/src/parsers/programdata.rs
// [VERIFIED] — ProgramData (bincode) parser from https://github.com/anza-xyz/solana/blob/master/programs/loader-v3-interface/src/state.rs

use solana_program::pubkey::Pubkey;
use std::io::{Cursor, Read};

#[derive(Clone, Copy, Debug)]
pub struct ParsedProgramData {
    pub deploy_slot: u64,
    pub upgrade_authority: Option<Pubkey>,
}

/// Parse ProgramData account (bincode format, 45-byte header + ELF)
/// Format: [u32 tag = 3 (ProgramData)] [u64 slot] [u8 Option tag] [Pubkey if Some]
pub fn parse_programdata(data: &[u8]) -> Result<ParsedProgramData, Box<dyn std::error::Error>> {
    if data.len() < 45 {
        return Err("data too short for ProgramData header".into());
    }

    let mut cursor = Cursor::new(data);
    let mut tag = [0u8; 4];
    cursor.read_exact(&mut tag)?;

    // Check for ProgramData enum tag (3)
    let tag_value = u32::from_le_bytes(tag);
    if tag_value != 3 {
        return Err("invalid ProgramData tag".into());
    }

    // Read deploy slot (u64, little-endian)
    let mut slot_bytes = [0u8; 8];
    cursor.read_exact(&mut slot_bytes)?;
    let deploy_slot = u64::from_le_bytes(slot_bytes);

    // Read Option tag (1 byte)
    let mut option_tag = [0u8];
    cursor.read_exact(&mut option_tag)?;

    let upgrade_authority = if option_tag[0] == 0 {
        None
    } else if option_tag[0] == 1 {
        // Read Pubkey (32 bytes)
        let mut pubkey_bytes = [0u8; 32];
        cursor.read_exact(&mut pubkey_bytes)?;
        Some(Pubkey::new_from_array(pubkey_bytes))
    } else {
        return Err("invalid Option tag in ProgramData".into());
    };

    Ok(ParsedProgramData {
        deploy_slot,
        upgrade_authority,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_programdata_immutable() {
        // Real-style ProgramData: Tag 3, slot 536870912, Option::None
        let mut data = vec![
            3, 0, 0, 0,                     // tag = 3 (little-endian)
        ];
        // slot = 536870912 (0x20000000, little-endian)
        data.extend_from_slice(&[0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00]);
        data.push(0);  // Option::None
        // Add padding to reach 45 bytes minimum
        data.extend_from_slice(&[0u8; 32]);

        let result = parse_programdata(&data).unwrap();
        assert_eq!(result.deploy_slot, 536870912);
        assert_eq!(result.upgrade_authority, None);
    }

    #[test]
    fn test_parse_programdata_with_authority() {
        // ProgramData with authority
        let mut data = vec![
            3, 0, 0, 0,                     // tag = 3
            0, 0, 0, 32, 0, 0, 0, 0,       // slot = 536870912
            1,                               // Option::Some
        ];
        // Add 32 bytes for Pubkey
        data.extend_from_slice(&[1u8; 32]);
        // Add dummy ELF bytes
        data.extend_from_slice(&[0u8; 100]);

        let result = parse_programdata(&data).unwrap();
        assert_eq!(result.deploy_slot, 536870912);
        assert!(result.upgrade_authority.is_some());
    }

    #[test]
    fn test_parse_programdata_short_data() {
        let data = vec![1, 2, 3];
        let result = parse_programdata(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_programdata_invalid_tag() {
        let data = [
            5, 0, 0, 0,                     // tag = 5 (invalid, should be 3)
            0, 0, 0, 0, 0, 0, 0, 0,
            0,
        ];
        let result = parse_programdata(&data);
        assert!(result.is_err());
    }
}
