//! `require_stage` (design/REVAMP-3.md, D8) on real mainnet bytes: Drift's Squads v4 multisig (4 of 7,
//! 3600 s), Jupiter's Squads v3 multisig, Marinade's coral multisig. Built by scripts/test-programs.sh.

mod common;

use anchor_lang::prelude::{AccountMeta, Pubkey};
use anchor_lang::AnchorDeserialize;
use common::*;
use keyholder::{multisig_stage, StageResult};
use std::str::FromStr;

fn require_stage_ix(h: &Harness, min_stage: u8, min_timelock_s: u32, multisig: Option<Pubkey>) -> anchor_lang::solana_program::instruction::Instruction {
    let mut args = vec![min_stage];
    args.extend_from_slice(&min_timelock_s.to_le_bytes());
    let accounts = vec![
        AccountMeta::new_readonly(h.target_program, false),
        AccountMeta::new_readonly(h.programdata, false),
        AccountMeta::new_readonly(multisig.unwrap_or(keyholder::ID), false), // Anchor's None-optional-account convention
    ];
    build_ix(keyholder::ID, "require_stage", &args, accounts)
}

fn run(h: &mut Harness, min_stage: u8, min_timelock_s: u32, multisig: Option<Pubkey>) -> Result<StageResult, String> {
    let ix = require_stage_ix(h, min_stage, min_timelock_s, multisig);
    match h.send(&[ix]) {
        Ok(r) => Ok(StageResult::try_from_slice(&r.return_data.data).expect("StageResult")),
        Err(e) => Err(format!("{:?}", e.err)),
    }
}

#[test]
fn stage_bands_match_the_offchain_engine() {
    assert_eq!(multisig_stage(1, 999_999_999), 0);
    assert_eq!(multisig_stage(2, 0), 1);
    assert_eq!(multisig_stage(2, 86_399), 1);
    assert_eq!(multisig_stage(2, 86_400), 2);
    assert_eq!(multisig_stage(2, 7 * 86_400 - 1), 2);
    assert_eq!(multisig_stage(2, 7 * 86_400), 3);
}

#[test]
fn drift_4of7_3600s_is_stage_1_read_live() {
    let mut h = Harness::new();
    let ms = h.multisig;
    let r = run(&mut h, 1, 0, Some(ms)).expect("stage 1 passes min 1");
    assert_eq!(r, StageResult { stage: 1, key_type: 2, threshold: 4, timelock_s: 3600 });
}

#[test]
fn drift_is_refused_by_a_stage_2_policy_and_by_a_24h_timelock_policy() {
    let mut h = Harness::new();
    let ms = h.multisig;
    assert!(run(&mut h, 2, 0, Some(ms)).is_err());
    assert!(run(&mut h, 1, 86_400, Some(ms)).is_err());
}

#[test]
fn omitting_the_multisig_can_only_make_it_stricter() {
    let mut h = Harness::new();
    let r = run(&mut h, 0, 0, None).expect("stage 0 passes min 0");
    assert_eq!(r.stage, 0);
    assert!(run(&mut h, 1, 0, None).is_err());
}

#[test]
fn a_multisig_the_authority_does_not_derive_from_is_rejected() {
    let mut h = Harness::new();
    // Jupiter's v3 multisig bytes at a different address: real layout, but not the controller of the target.
    let other = Pubkey::from_str("7ZyDFzet6sKgZLN4D89JLfo7chu2n7nYdkFt5RCFk8Sf").unwrap();
    h.svm.set_account(other, solana_account::Account { lamports: 10_000_000, data: fixture_bytes("jupiter-squads-v3-multisig.json"), owner: Pubkey::from_str("SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu").unwrap(), executable: false, rent_epoch: 0 }).unwrap();
    assert!(run(&mut h, 0, 0, Some(other)).is_err());
}

#[test]
fn immutable_programs_are_stage_3() {
    let mut h = Harness::new();
    let mut pd = h.svm.get_account(&h.programdata).unwrap();
    pd.data[12] = 0; // Option<Pubkey> = None: no upgrade authority
    h.svm.set_account(h.programdata, pd).unwrap();
    let r = run(&mut h, 3, 0, None).expect("immutable passes min 3");
    assert_eq!(r.stage, 3);
}

#[test]
fn squads_v3_and_coral_have_no_timelock_so_cap_at_stage_1() {
    let mut h = Harness::new();
    h.use_multisig("jupiter-squads-v3-multisig.json", Pubkey::from_str("7ZyDFzet6sKgZLN4D89JLfo7chu2n7nYdkFt5RCFk8Sf").unwrap(), Pubkey::from_str("SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu").unwrap(), Pubkey::from_str("CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ").unwrap());
    let ms = h.multisig;
    let r = run(&mut h, 1, 0, Some(ms)).expect("v3 passes min 1");
    assert_eq!((r.stage, r.key_type, r.timelock_s), (1, 5, 0));
    let mut h = Harness::new();
    h.use_multisig("marinade-coral-multisig.json", Pubkey::from_str("magrsHFQxkkioAy45VWnZnFBBdKVdy2ZiRoRGYT9Wed").unwrap(), Pubkey::from_str("msigmtwzgXJHj2ext4XJjCDmpbcMuufFb5cHuwg6Xdt").unwrap(), Pubkey::from_str("551FBXSXdhcRDDkdcb3ThDRg84Mwe5Zs6YjJ1EEoyzBp").unwrap());
    let ms = h.multisig;
    let r = run(&mut h, 1, 0, Some(ms)).expect("coral passes min 1");
    assert_eq!((r.stage, r.key_type), (1, 6));
}

#[test]
fn a_wrong_programdata_account_is_rejected() {
    let mut h = Harness::new();
    let ms = h.multisig;
    let fake = Pubkey::new_unique();
    let pd = h.svm.get_account(&h.programdata).unwrap();
    h.svm.set_account(fake, pd).unwrap();
    let real = h.programdata;
    h.programdata = fake;
    assert!(run(&mut h, 0, 0, Some(ms)).is_err());
    h.programdata = real;
}
