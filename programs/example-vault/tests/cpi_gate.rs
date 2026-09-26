//! Proves the CPI gate end-to-end: `example_vault::deposit` CPIs
//! `keyholder::check` (Enforce mode) before crediting a deposit. Loads real
//! Drift multisig bytes (4-of-7/3600s -> pass) then the real Security
//! Council bytes (2-of-5/0s -> refused), exactly as in
//! programs/keyholder/tests/litesvm_tests.rs, but through a second program's
//! CPI boundary rather than calling keyholder directly.

use anchor_lang::prelude::{AccountMeta, Pubkey};
use base64::Engine;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{v0, Instruction, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use sha2::{Digest, Sha256};
use std::str::FromStr;

fn ix_sighash(name: &str) -> [u8; 8] {
    let digest = Sha256::digest(format!("global:{name}").as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

fn fixture_bytes(name: &str) -> Vec<u8> {
    let path = format!(
        "{}/../keyholder/tests/fixtures/{name}",
        env!("CARGO_MANIFEST_DIR")
    );
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"));
    let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let data_b64 = json["data_b64"].as_str().unwrap();
    base64::engine::general_purpose::STANDARD.decode(data_b64).unwrap()
}

fn loader_id() -> Pubkey {
    anchor_lang::solana_program::bpf_loader_upgradeable::ID
}
fn squads_v4_id() -> Pubkey {
    keyholder::parsers::squads_v4_program_id()
}

struct Setup {
    svm: LiteSVM,
    payer: Keypair,
    target_program: Pubkey,
    programdata: Pubkey,
    multisig: Pubkey,
    vault: Pubkey,
    policy: Pubkey,
}

fn setup() -> Setup {
    let mut svm = LiteSVM::new().with_sysvars().with_builtins().with_default_programs();
    svm.warp_to_slot(10);
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    let kh_so = format!("{}/../../target/test-sbf/keyholder.so", env!("CARGO_MANIFEST_DIR"));
    svm.add_program_from_file(keyholder::ID, &kh_so).unwrap();
    let ev_so = format!("{}/../../target/test-sbf/example_vault.so", env!("CARGO_MANIFEST_DIR"));
    svm.add_program_from_file(example_vault::ID, &ev_so).unwrap();

    let target_program = Pubkey::from_str("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH").unwrap();
    let programdata = Pubkey::find_program_address(&[target_program.as_ref()], &loader_id()).0;
    let multisig = Pubkey::from_str("7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM").unwrap();

    // Real loadable bytecode standing in for the target program.
    svm.add_program_from_file(target_program, &ev_so).unwrap();
    svm.set_account(
        programdata,
        solana_account::Account { lamports: 10_000_000, data: fixture_bytes("drift-programdata.json"), owner: loader_id(), executable: false, rent_epoch: 0 },
    ).unwrap();
    svm.set_account(
        multisig,
        solana_account::Account { lamports: 10_000_000, data: fixture_bytes("drift-4of7-multisig.json"), owner: squads_v4_id(), executable: false, rent_epoch: 0 },
    ).unwrap();

    // init_config
    let (config, _) = Pubkey::find_program_address(&[b"config"], &keyholder::ID);
    let (registry, _) = Pubkey::find_program_address(&[b"attesters"], &keyholder::ID);
    send(&mut svm, &payer, &[Instruction {
        program_id: keyholder::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(config, false),
            AccountMeta::new(registry, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data: [ix_sighash("init_config").to_vec(), borsh::to_vec(&10_000u64).unwrap()].concat(),
    }]).unwrap();

    // register_target
    let (control, _) = Pubkey::find_program_address(&[b"control", target_program.as_ref()], &keyholder::ID);
    send(&mut svm, &payer, &[Instruction {
        program_id: keyholder::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(control, false),
            AccountMeta::new_readonly(target_program, false),
            AccountMeta::new_readonly(programdata, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(multisig, false),
        ],
        data: ix_sighash("register_target").to_vec(),
    }]).unwrap();

    // create_policy: min_threshold=3, min_time_lock=3600, Enforce mode
    let (policy, _) = Pubkey::find_program_address(&[b"policy", payer.pubkey().as_ref(), &0u64.to_le_bytes()], &keyholder::ID);
    let mut params = Vec::new();
    params.extend_from_slice(&3u16.to_le_bytes()); // min_threshold
    params.extend_from_slice(&3600u32.to_le_bytes()); // min_time_lock
    params.push(0); // allow_single_key = false
    params.extend_from_slice(&0u64.to_le_bytes()); // cooldown_after_weaken_slots
    params.extend_from_slice(&0u64.to_le_bytes()); // cooldown_after_deploy_slots
    params.extend_from_slice(&0u64.to_le_bytes()); // max_refresh_age_slots
    params.push(0); // require_attested_ok
    params.push(3); // max_risk_level
    params.push(0); // require_verified_build
    params.push(0); // mode = Enforce
    params.extend_from_slice(&5u64.to_le_bytes()); // policy_update_timelock_slots
    let mut data = ix_sighash("create_policy").to_vec();
    data.extend_from_slice(&0u64.to_le_bytes()); // policy_id
    data.extend_from_slice(&params);
    send(&mut svm, &payer, &[Instruction {
        program_id: keyholder::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(policy, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data,
    }]).unwrap();

    // init_vault
    let (vault, _) = Pubkey::find_program_address(&[b"vault", payer.pubkey().as_ref()], &example_vault::ID);
    send(&mut svm, &payer, &[Instruction {
        program_id: example_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
        ],
        data: ix_sighash("init_vault").to_vec(),
    }]).unwrap();

    Setup { svm, payer, target_program, programdata, multisig, vault, policy }
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ixs: &[Instruction]) -> litesvm::types::TransactionResult {
    let msg = v0::Message::try_compile(&payer.pubkey(), ixs, &[], svm.latest_blockhash()).unwrap();
    let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[payer]).unwrap();
    svm.send_transaction(tx)
}

fn deposit_ix(s: &Setup, amount: u64) -> Instruction {
    let (config, _) = Pubkey::find_program_address(&[b"config"], &keyholder::ID);
    let (control, _) = Pubkey::find_program_address(&[b"control", s.target_program.as_ref()], &keyholder::ID);
    Instruction {
        program_id: example_vault::ID,
        accounts: vec![
            AccountMeta::new(s.payer.pubkey(), true),
            AccountMeta::new(s.vault, false),
            AccountMeta::new_readonly(s.policy, false),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new_readonly(control, false),
            AccountMeta::new_readonly(s.target_program, false),
            AccountMeta::new_readonly(s.programdata, false),
            AccountMeta::new_readonly(s.multisig, false),
            AccountMeta::new_readonly(keyholder::ID, false),
        ],
        data: [ix_sighash("deposit").to_vec(), borsh::to_vec(&amount).unwrap()].concat(),
    }
}

#[test]
fn deposit_succeeds_before_threshold_drop_and_reverts_after() {
    let mut s = setup();

    // BEFORE: real Drift bytes are 4-of-7 / 3600s -> policy (min 3 / 3600s) passes.
    let ix = deposit_ix(&s, 1_000);
    let before = send(&mut s.svm, &s.payer, &[ix]);
    assert!(before.is_ok(), "deposit must succeed while control is strong: {before:?}");

    // Weaken: swap in the real Security Council bytes (2-of-5, 0s timelock)
    // and refresh, exactly as the live devnet flip does.
    let council_bytes = fixture_bytes("council-2of5-multisig.json");
    let mut ms_account = s.svm.get_account(&s.multisig).unwrap();
    ms_account.data = council_bytes;
    s.svm.set_account(s.multisig, ms_account).unwrap();

    let refresh_ix = Instruction {
        program_id: keyholder::ID,
        accounts: vec![
            AccountMeta::new(Pubkey::find_program_address(&[b"control", s.target_program.as_ref()], &keyholder::ID).0, false),
            AccountMeta::new_readonly(s.target_program, false),
            AccountMeta::new_readonly(s.programdata, false),
            AccountMeta::new_readonly(s.multisig, false),
        ],
        data: ix_sighash("refresh").to_vec(),
    };
    send(&mut s.svm, &s.payer, &[refresh_ix]).expect("refresh succeeds");

    // AFTER: threshold 2 < policy's min_threshold 3 -> keyholder::check
    // returns GuardError::ThresholdBelowPolicy, the CPI bubbles it up, and
    // the whole deposit transaction reverts (no funds move; CEI-safe).
    let ix2 = deposit_ix(&s, 1_000);
    let after = send(&mut s.svm, &s.payer, &[ix2]);
    assert!(after.is_err(), "deposit must revert once control weakens below policy: {after:?}");
}
