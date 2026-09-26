//! Shared LiteSVM harness for keyholder's integration tests: raw instruction
//! building (no generated client — proves the manual/non-Anchor integration
//! path from ONCHAIN.md §4 works too), account fixtures loaded from real
//! mainnet bytes, and small helpers.

use base64::Engine;
use keyholder::{
    AttesterRegistry, CheckResult, Config, ControlState, Policy, PolicyParams, CONFIG_SEED,
    CONTROL_SEED, POLICY_SEED, ATTESTERS_SEED,
};
use litesvm::LiteSVM;
use litesvm::types::TransactionResult;
use solana_account::Account;
use solana_keypair::Keypair;
use solana_message::{v0, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use anchor_lang::prelude::{AccountMeta, Pubkey};
use solana_message::Instruction;
use anchor_lang::AccountDeserialize;
use anchor_lang::AnchorDeserialize;
use sha2::{Digest, Sha256};
use std::str::FromStr;

pub fn keyholder_id() -> Pubkey {
    keyholder::ID
}

pub fn loader_id() -> Pubkey {
    anchor_lang::solana_program::bpf_loader_upgradeable::ID
}

pub fn squads_v4_id() -> Pubkey {
    keyholder::parsers::squads_v4_program_id()
}

/// sha256("global:<name>")[..8] — Anchor's instruction sighash.
pub fn ix_sighash(name: &str) -> [u8; 8] {
    let digest = Sha256::digest(format!("global:{name}").as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

pub fn build_ix(program_id: Pubkey, name: &str, args: &[u8], accounts: Vec<AccountMeta>) -> Instruction {
    let mut data = ix_sighash(name).to_vec();
    data.extend_from_slice(args);
    Instruction { program_id, accounts, data }
}

pub fn fixture_bytes(name: &str) -> Vec<u8> {
    let path = format!(
        "{}/tests/fixtures/{name}",
        env!("CARGO_MANIFEST_DIR")
    );
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"));
    let json: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let data_b64 = json["data_b64"].as_str().unwrap();
    base64::engine::general_purpose::STANDARD.decode(data_b64).unwrap()
}

pub fn drift_target_program() -> Pubkey {
    Pubkey::from_str("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH").unwrap()
}

pub fn drift_multisig() -> Pubkey {
    Pubkey::from_str("7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM").unwrap()
}

pub fn payer_kp() -> Keypair {
    Keypair::new()
}

/// A fresh LiteSVM with keyholder + example-vault loaded, and the target
/// program / programdata / multisig accounts seeded with real Drift bytes
/// (4-of-7, 3600s timelock at time of capture, 2026-09-26).
pub struct Harness {
    pub svm: LiteSVM,
    pub payer: Keypair,
    pub target_program: Pubkey,
    pub programdata: Pubkey,
    pub multisig: Pubkey,
}

impl Harness {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new().with_sysvars().with_builtins().with_default_programs();
        // LiteSVM starts at slot 0; several tests rely on "changed at slot X"
        // being distinguishable from the zero-value sentinel used for
        // "never happened" (last_weakened_slot, attested_at_slot).
        svm.warp_to_slot(10);
        let payer = payer_kp();
        svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

        let so_path = format!("{}/../../target/deploy/keyholder.so", env!("CARGO_MANIFEST_DIR"));
        svm.add_program_from_file(keyholder::ID, &so_path)
            .unwrap_or_else(|e| panic!("load keyholder.so from {so_path}: {e:?}"));

        let vault_so = format!("{}/../../target/deploy/example_vault.so", env!("CARGO_MANIFEST_DIR"));
        if std::path::Path::new(&vault_so).exists() {
            svm.add_program_from_file(example_vault_id(), &vault_so).unwrap();
        }

        // The "target" needs to be a *real* loadable program (LiteSVM
        // validates and caches the ELF of any account marked executable),
        // so we register it with a throwaway keypair via the same
        // `add_program_from_file` path used for keyholder/example-vault,
        // reusing the example-vault binary as inert bytecode. This gives us
        // a real Program account + a real ProgramData account at the
        // canonical PDA. We then overwrite that ProgramData account's *data*
        // with the real Drift fixture bytes: the account is not executable,
        // so LiteSVM never re-validates it as a program, and the actual
        // invokable bytecode stays cached from the original load — only
        // what `parse_programdata` reads changes.
        let target_program = drift_target_program();
        let programdata = Pubkey::find_program_address(&[target_program.as_ref()], &loader_id()).0;
        let multisig = drift_multisig();

        svm.add_program_from_file(target_program, &vault_so)
            .unwrap_or_else(|e| panic!("load target_program stand-in from {vault_so}: {e:?}"));

        let pd_bytes = fixture_bytes("drift-programdata.json");
        svm.set_account(
            programdata,
            Account { lamports: 10_000_000, data: pd_bytes, owner: loader_id(), executable: false, rent_epoch: 0 },
        )
        .unwrap();

        let ms_bytes = fixture_bytes("drift-4of7-multisig.json");
        svm.set_account(
            multisig,
            Account { lamports: 10_000_000, data: ms_bytes, owner: squads_v4_id(), executable: false, rent_epoch: 0 },
        )
        .unwrap();

        Self { svm, payer, target_program, programdata, multisig }
    }

    pub fn send(&mut self, ixs: &[Instruction]) -> TransactionResult {
        let msg = v0::Message::try_compile(&self.payer.pubkey(), ixs, &[], self.svm.latest_blockhash()).unwrap();
        let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&self.payer]).unwrap();
        self.svm.send_transaction(tx)
    }

    /// Sends a transaction fee-paid and signed by `signer` instead of `self.payer`
    /// (for instructions where a non-payer account must be the signer, e.g.
    /// a policy owner or an attester).
    pub fn send_signed(&mut self, signer: &Keypair, ixs: &[Instruction]) -> TransactionResult {
        let msg = v0::Message::try_compile(&signer.pubkey(), ixs, &[], self.svm.latest_blockhash()).unwrap();
        let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[signer]).unwrap();
        self.svm.send_transaction(tx)
    }

    pub fn config_pda(&self) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[CONFIG_SEED], &keyholder::ID)
    }
    pub fn attesters_pda(&self) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[ATTESTERS_SEED], &keyholder::ID)
    }
    pub fn control_pda(&self, target: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[CONTROL_SEED, target.as_ref()], &keyholder::ID)
    }
    pub fn policy_pda(&self, owner: &Pubkey, id: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[POLICY_SEED, owner.as_ref(), &id.to_le_bytes()], &keyholder::ID)
    }

    pub fn init_config(&mut self) {
        let (config, _) = self.config_pda();
        let (registry, _) = self.attesters_pda();
        let ix = build_ix(
            keyholder::ID,
            "init_config",
            &borsh::to_vec(&10_000u64).unwrap(),
            vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new(config, false),
                AccountMeta::new(registry, false),
                AccountMeta::new_readonly(solana_system_id(), false),
            ],
        );
        self.send(&[ix]).unwrap();
    }

    pub fn register_target(&mut self) -> Pubkey {
        let (control, _) = self.control_pda(&self.target_program);
        let ix = build_ix(
            keyholder::ID,
            "register_target",
            &[],
            vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new(control, false),
                AccountMeta::new_readonly(self.target_program, false),
                AccountMeta::new_readonly(self.programdata, false),
                AccountMeta::new_readonly(solana_system_id(), false),
                AccountMeta::new_readonly(self.multisig, false),
            ],
        );
        self.send(&[ix]).unwrap();
        control
    }

    pub fn refresh(&mut self) -> TransactionResult {
        let (control, _) = self.control_pda(&self.target_program);
        let ix = build_ix(
            keyholder::ID,
            "refresh",
            &[],
            vec![
                AccountMeta::new(control, false),
                AccountMeta::new_readonly(self.target_program, false),
                AccountMeta::new_readonly(self.programdata, false),
                AccountMeta::new_readonly(self.multisig, false),
            ],
        );
        self.send(&[ix])
    }

    pub fn swap_multisig_bytes(&mut self, fixture: &str, owner: Pubkey) {
        let bytes = fixture_bytes(fixture);
        let mut acct = self.svm.get_account(&self.multisig).unwrap();
        acct.data = bytes;
        acct.owner = owner;
        self.svm.set_account(self.multisig, acct).unwrap();
    }

    pub fn create_policy(&mut self, owner: &Keypair, policy_id: u64, params: PolicyParams) -> Pubkey {
        let (policy, _) = self.policy_pda(&owner.pubkey(), policy_id);
        let mut data = borsh::to_vec(&policy_id).unwrap();
        data.extend_from_slice(&borsh::to_vec(&params).unwrap());
        let ix = build_ix(
            keyholder::ID,
            "create_policy",
            &data,
            vec![
                AccountMeta::new(owner.pubkey(), true),
                AccountMeta::new(policy, false),
                AccountMeta::new_readonly(solana_system_id(), false),
            ],
        );
        let msg = v0::Message::try_compile(&owner.pubkey(), &[ix], &[], self.svm.latest_blockhash()).unwrap();
        self.svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
        let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[owner]).unwrap();
        self.svm.send_transaction(tx).unwrap();
        policy
    }

    pub fn check_ix(&self, policy: Pubkey, multisig_required: bool) -> Instruction {
        let (config, _) = self.config_pda();
        let (control, _) = self.control_pda(&self.target_program);
        let mut accounts = vec![
            AccountMeta::new_readonly(policy, false),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new_readonly(control, false),
            AccountMeta::new_readonly(self.target_program, false),
            AccountMeta::new_readonly(self.programdata, false),
        ];
        if multisig_required {
            accounts.push(AccountMeta::new_readonly(self.multisig, false));
        } else {
            accounts.push(AccountMeta::new_readonly(keyholder::ID, false)); // Anchor's None-optional-account convention
        }
        build_ix(keyholder::ID, "check", &[], accounts)
    }

    pub fn fetch_control(&self, target: &Pubkey) -> ControlState {
        let (control, _) = self.control_pda(target);
        let acct = self.svm.get_account(&control).unwrap();
        ControlState::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }

    pub fn fetch_policy(&self, owner: &Pubkey, id: u64) -> Policy {
        let (policy, _) = self.policy_pda(owner, id);
        let acct = self.svm.get_account(&policy).unwrap();
        Policy::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }

    #[allow(dead_code)]
    pub fn fetch_config(&self) -> Config {
        let (config, _) = self.config_pda();
        let acct = self.svm.get_account(&config).unwrap();
        Config::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }

    #[allow(dead_code)]
    pub fn fetch_registry(&self) -> AttesterRegistry {
        let (registry, _) = self.attesters_pda();
        let acct = self.svm.get_account(&registry).unwrap();
        AttesterRegistry::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }
}

pub fn example_vault_id() -> Pubkey {
    "4dj7Nu6j5sb9dzL1NRk4RRFJFXxSdt6bQzfboqZsXMNY".parse().unwrap()
}

pub fn solana_system_id() -> Pubkey {
    anchor_lang::solana_program::system_program::ID
}

pub fn decode_check_result(meta_return_data: &[u8]) -> CheckResult {
    CheckResult::try_from_slice(meta_return_data).expect("decode CheckResult")
}

pub fn default_policy_params() -> PolicyParams {
    PolicyParams {
        min_threshold: 0,
        min_time_lock: 0,
        allow_single_key: true,
        cooldown_after_weaken_slots: 0,
        cooldown_after_deploy_slots: 0,
        max_refresh_age_slots: 0,
        require_attested_ok: false,
        max_risk_level: 3,
        require_verified_build: false,
        mode: 0, // Enforce
        policy_update_timelock_slots: 5,
    }
}
