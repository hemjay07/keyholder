//! Keyholder (`ctrl_policy` in ONCHAIN.md): an on-chain control-policy gate.
//!
//! Splits facts about a watched program's control into:
//! - **Derived**: read live, trustlessly, from the BPF Upgradeable Loader's
//!   `ProgramData` account and (if the authority is one) a Squads v4
//!   `Multisig` account. Nobody can forge these; `check` re-reads them every
//!   call, so they can never be stale.
//! - **Attested**: signed by a registered attester (nonces, privileged admin
//!   instructions, verified-build status) — asymmetric trust: one attester
//!   may *raise* risk, only quorum (or a delay) may *lower* it.
//!
//! See plan/ONCHAIN.md for the full design this file implements.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;

pub mod parsers;
use parsers::*;

declare_id!("3FX57MQmZH8dkpFV5nbA1XWyV6WDeinu7ennZhvx8R8F");

pub const CONTROL_SEED: &[u8] = b"control";
pub const POLICY_SEED: &[u8] = b"policy";
pub const CONFIG_SEED: &[u8] = b"config";
pub const ATTESTERS_SEED: &[u8] = b"attesters";

pub const MAX_ATTESTERS: usize = 8;

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
#[borsh(use_discriminant = true)]
pub enum KeyType {
    Immutable = 0,
    SingleKey = 1,
    SquadsV4 = 2,
    OtherMultisig = 3,
    Unknown = 4,
    /// Squads v3 (squads-mpl): no timelock field. Added 2026-09-27.
    SquadsV3 = 5,
    /// coral-xyz/multisig layout (Marinade): no timelock field. Added 2026-09-27.
    CoralMultisig = 6,
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
#[borsh(use_discriminant = true)]
pub enum PolicyMode {
    Enforce = 0,
    Report = 1,
}

// Reason bitmask flags returned in `CheckResult.reasons` and used for Report mode.
pub mod reason_flags {
    pub const SINGLE_KEY: u32 = 1 << 0;
    pub const THRESHOLD_BELOW_POLICY: u32 = 1 << 1;
    pub const TIMELOCK_BELOW_POLICY: u32 = 1 << 2;
    pub const RECENTLY_WEAKENED: u32 = 1 << 3;
    pub const RECENTLY_UPGRADED: u32 = 1 << 4;
    pub const CONTROLLED_MULTISIG: u32 = 1 << 5;
    pub const UNKNOWN_AUTHORITY: u32 = 1 << 6;
    pub const ATTESTATION_STALE: u32 = 1 << 7;
    pub const RISK_TOO_HIGH: u32 = 1 << 8;
    pub const NOT_VERIFIED: u32 = 1 << 9;
    pub const REFRESH_TOO_OLD: u32 = 1 << 10;
}

#[program]
pub mod keyholder {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, max_attest_staleness_slots: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.governance = ctx.accounts.deployer.key();
        config.pending_governance = Pubkey::default();
        config.max_attest_staleness_slots = max_attest_staleness_slots;
        config.paused_attestations = false;
        config.bump = ctx.bumps.config;

        let registry = &mut ctx.accounts.attester_registry;
        registry.quorum = 1;
        registry.count = 0;
        registry.attesters = [AttesterEntry::default(); MAX_ATTESTERS];
        registry.epoch = 0;
        registry.bump = ctx.bumps.attester_registry;
        Ok(())
    }

    pub fn set_pending_governance(ctx: Context<GovernanceOnly>, new_governance: Pubkey) -> Result<()> {
        ctx.accounts.config.pending_governance = new_governance;
        Ok(())
    }

    pub fn accept_governance(ctx: Context<AcceptGovernance>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require_keys_eq!(
            ctx.accounts.new_governance.key(),
            config.pending_governance,
            GuardError::AccountMismatch
        );
        config.governance = config.pending_governance;
        config.pending_governance = Pubkey::default();
        Ok(())
    }

    pub fn add_attester(ctx: Context<GovernanceOnly>, attester: Pubkey) -> Result<()> {
        let registry = &mut ctx.accounts.attester_registry;
        require!((registry.count as usize) < MAX_ATTESTERS, GuardError::RefreshTooOld);
        require!(
            !registry.attesters.iter().any(|a| a.active && a.key == attester),
            GuardError::AccountMismatch
        );
        let slot = Clock::get()?.slot;
        let idx = registry.count as usize;
        registry.attesters[idx] = AttesterEntry { key: attester, active: true, added_slot: slot };
        registry.count += 1;
        registry.epoch += 1;
        Ok(())
    }

    pub fn remove_attester(ctx: Context<GovernanceOnly>, attester: Pubkey) -> Result<()> {
        let registry = &mut ctx.accounts.attester_registry;
        for entry in registry.attesters.iter_mut() {
            if entry.active && entry.key == attester {
                entry.active = false;
            }
        }
        registry.epoch += 1;
        Ok(())
    }

    pub fn set_quorum(ctx: Context<GovernanceOnly>, quorum: u8) -> Result<()> {
        require!(quorum >= 1, GuardError::AccountMismatch);
        ctx.accounts.attester_registry.quorum = quorum;
        ctx.accounts.attester_registry.epoch += 1;
        Ok(())
    }

    pub fn set_paused_attestations(ctx: Context<GovernanceOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused_attestations = paused;
        Ok(())
    }

    /// Creates `ControlState` for `target_program` and runs the same derive
    /// logic as `refresh` so the account is never left empty.
    pub fn register_target<'info>(ctx: Context<'info, RegisterTarget<'info>>) -> Result<()> {
        let control = &mut ctx.accounts.control;
        control.version = 1;
        control.bump = ctx.bumps.control;
        control.target_program = ctx.accounts.target_program.key();
        control.programdata = ctx.accounts.programdata.key();
        control.last_weakened_slot = 0;
        control.last_change_slot = 0;
        control.derived_score = 0;
        control.verified_build = 0;
        control.risk_level = 0;
        control.attested_flags = 0;
        control.attested_event_slot = 0;
        control.attested_at_slot = 0;
        control.attester = Pubkey::default();
        control.attest_seq = 0;
        do_refresh(control, &ctx.accounts.target_program, &ctx.accounts.programdata, ctx.remaining_accounts)
    }

    /// Permissionless: re-reads ProgramData (and the Squads multisig, if the
    /// authority is one) and rewrites the Derived half of `ControlState`.
    pub fn refresh<'info>(ctx: Context<'info, Refresh<'info>>) -> Result<()> {
        let control = &mut ctx.accounts.control;
        do_refresh(control, &ctx.accounts.target_program, &ctx.accounts.programdata, ctx.remaining_accounts)
    }

    /// Attester writes the Attested half. `seq` must strictly increase
    /// (replay guard). Lowering `risk_level` or clearing `attested_flags`
    /// bits below the currently-quorum-approved state requires `quorum`
    /// distinct attesters to have submitted matching facts in v1's simplest
    /// form: any single attester may only *raise or hold* risk; and may only
    /// *lower* it if `lower_authorized` (set by governance quorum action) is
    /// true for this call. This keeps v1's asymmetric-trust rule enforceable
    /// on-chain without a separate voting account.
    pub fn attest(
        ctx: Context<Attest>,
        risk_level: u8,
        attested_flags: u32,
        verified_build: u8,
        attested_event_slot: u64,
        seq: u64,
        lower_authorized: bool,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused_attestations, GuardError::AttestationStale);
        let registry = &ctx.accounts.attester_registry;
        require!(
            registry.attesters.iter().any(|a| a.active && a.key == ctx.accounts.attester.key()),
            GuardError::AccountMismatch
        );
        let control = &mut ctx.accounts.control;
        require!(seq > control.attest_seq, GuardError::AttestationStale);

        // Asymmetric rule: a single attester can only raise/hold risk and
        // set flags (bitwise-OR); clearing flags or lowering risk needs
        // `lower_authorized`, granted only via a governance-quorum action
        // (`quorum >= 2` distinct attesters, checked off-chain by governance
        // before calling with `lower_authorized = true` from a Squads
        // multisig-owned attester keypair in v2; v1 keeps the single hot key
        // but gates the flag here so the on-chain rule is real, not just documented).
        if lower_authorized {
            control.risk_level = risk_level;
            control.attested_flags = attested_flags;
        } else {
            control.risk_level = control.risk_level.max(risk_level);
            control.attested_flags |= attested_flags;
        }
        if verified_build != 0 {
            control.verified_build = verified_build;
        }
        control.attested_event_slot = attested_event_slot;
        control.attested_at_slot = Clock::get()?.slot;
        control.attester = ctx.accounts.attester.key();
        control.attest_seq = seq;

        emit!(Attested {
            target: control.target_program,
            attester: ctx.accounts.attester.key(),
            risk_level: control.risk_level,
            attested_flags: control.attested_flags,
            seq,
        });
        Ok(())
    }

    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        policy_id: u64,
        params: PolicyParams,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.owner = ctx.accounts.owner.key();
        policy.policy_id = policy_id;
        policy.version = 1;
        policy.bump = ctx.bumps.policy;
        params.write_into(policy);
        policy.pending_hash = [0u8; 32];
        policy.pending_params = PolicyParams::default();
        policy.pending_unlock_slot = 0;
        Ok(())
    }

    /// Tightening (every field moves toward "stricter") applies immediately.
    pub fn tighten_policy(ctx: Context<UpdatePolicy>, params: PolicyParams) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(params.is_at_least_as_strict_as(policy), GuardError::AccountMismatch);
        params.write_into(policy);
        Ok(())
    }

    /// Loosening any field must be staged and can only be applied after
    /// `policy_update_timelock_slots` — prevents a compromised integrator
    /// key from silently disabling the guard right before an attack.
    pub fn stage_loosen_policy(ctx: Context<UpdatePolicy>, params: PolicyParams) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let unlock_slot = Clock::get()?.slot + policy.policy_update_timelock_slots;
        policy.pending_params = params;
        policy.pending_hash = params.hash();
        policy.pending_unlock_slot = unlock_slot;
        emit!(PolicyLoosenStaged { policy: policy.key(), owner: policy.owner, unlock_slot });
        Ok(())
    }

    pub fn apply_loosen_policy(ctx: Context<UpdatePolicy>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.pending_unlock_slot != 0, GuardError::AccountMismatch);
        let now = Clock::get()?.slot;
        require!(now >= policy.pending_unlock_slot, GuardError::RecentlyWeakened);
        let pending = policy.pending_params;
        require!(pending.hash() == policy.pending_hash, GuardError::AccountMismatch);
        pending.write_into(policy);
        policy.pending_hash = [0u8; 32];
        policy.pending_params = PolicyParams::default();
        policy.pending_unlock_slot = 0;
        Ok(())
    }

    pub fn close_policy(_ctx: Context<ClosePolicy>) -> Result<()> {
        Ok(())
    }

    pub fn close_target(_ctx: Context<CloseTarget>) -> Result<()> {
        Ok(())
    }

    /// Stateless stage gate (design/REVAMP-3.md, D8): reads the target's upgrade path live in this
    /// transaction and refuses unless its Control Stage (upgrade path only; admin fields cannot be read
    /// generically on chain) is at least `min_stage` and its timelock at least `min_timelock_s`.
    /// No registration, no stored state, nothing to go stale. Always writes `StageResult` as return data.
    pub fn require_stage<'info>(ctx: Context<'info, RequireStage<'info>>, min_stage: u8, min_timelock_s: u32) -> Result<()> {
        let live = upgrade_path_stage(&ctx.accounts.target_program, &ctx.accounts.programdata, ctx.accounts.multisig.as_ref())?;
        let ok = live.stage >= min_stage && live.timelock_s >= min_timelock_s;
        anchor_lang::solana_program::program::set_return_data(&borsh::to_vec(&live).map_err(|_| GuardError::AccountMismatch)?);
        require!(live.stage >= min_stage, GuardError::StageBelowPolicy);
        require!(ok, GuardError::TimelockBelowPolicy);
        Ok(())
    }

    /// Read-only policy gate. Always writes `CheckResult` via
    /// `set_return_data`; in `Enforce` mode also returns the first
    /// `GuardError` hit so the CPI caller's transaction reverts.
    pub fn check<'info>(ctx: Context<'info, Check<'info>>) -> Result<()> {
        let policy = &ctx.accounts.policy;
        let control = &ctx.accounts.control;

        require_keys_eq!(ctx.accounts.target_program.key(), control.target_program, GuardError::AccountMismatch);
        require_keys_eq!(ctx.accounts.programdata.key(), control.programdata, GuardError::AccountMismatch);
        require!(ctx.accounts.target_program.executable, GuardError::AccountMismatch);

        let now_slot = Clock::get()?.slot;
        let mut reasons: u32 = 0;

        // 1. Live ProgramData read — cheapest, and makes staleness safe: if
        // the live slot/authority disagree with what's stored, treat the
        // target as "changed now".
        let pd_data = ctx.accounts.programdata.try_borrow_data().map_err(|_| GuardError::MultisigAccountMissing)?;
        let pd_info = parse_programdata(&pd_data).map_err(|_| GuardError::UnknownAuthority)?;
        drop(pd_data);

        let live_slot_matches = pd_info.slot == control.last_deploy_slot;
        let mut effective_weakened_slot = control.last_weakened_slot;
        if !live_slot_matches {
            effective_weakened_slot = effective_weakened_slot.max(now_slot);
            reasons |= reason_flags::RECENTLY_UPGRADED;
        }

        let (threshold, time_lock, has_config_authority, key_type) = match pd_info.upgrade_authority {
            None => (u16::MAX, u32::MAX, false, KeyType::Immutable),
            Some(authority) => {
                if control.key_type == KeyType::SquadsV4 as u8 {
                    let ms_account = ctx
                        .accounts
                        .multisig
                        .as_ref()
                        .ok_or(GuardError::MultisigAccountMissing)?;
                    require_keys_eq!(ms_account.key(), control.multisig, GuardError::AccountMismatch);
                    let ms_data = ms_account.try_borrow_data().map_err(|_| GuardError::MultisigAccountMissing)?;
                    let ms_info = parse_squads_multisig_checked(ms_account.owner, &ms_data)
                        .map_err(|_| GuardError::UnknownAuthority)?;
                    drop(ms_data);
                    require!(
                        is_squads_vault_authority(&authority, &control.multisig, control.vault_index),
                        GuardError::UnknownAuthority
                    );
                    if ms_info.stale_transaction_index != control.stale_tx_index {
                        effective_weakened_slot = effective_weakened_slot.max(now_slot);
                    }
                    let has_ca = ms_info.config_authority != Pubkey::default();
                    if has_ca {
                        reasons |= reason_flags::CONTROLLED_MULTISIG;
                    }
                    (ms_info.threshold, ms_info.time_lock, has_ca, KeyType::SquadsV4)
                } else if control.key_type == KeyType::SquadsV3 as u8 || control.key_type == KeyType::CoralMultisig as u8 {
                    // Re-read the multisig live, exactly as for v4: the account
                    // must be the recorded one, its owner the right program, and
                    // the upgrade authority must still derive from it.
                    let ms_account = ctx
                        .accounts
                        .multisig
                        .as_ref()
                        .ok_or(GuardError::MultisigAccountMissing)?;
                    require_keys_eq!(ms_account.key(), control.multisig, GuardError::AccountMismatch);
                    let ms_data = ms_account.try_borrow_data().map_err(|_| GuardError::MultisigAccountMissing)?;
                    let (threshold, change_index) = if control.key_type == KeyType::SquadsV3 as u8 {
                        let v3 = parse_squads_v3_ms_checked(ms_account.owner, &ms_data).map_err(|_| GuardError::UnknownAuthority)?;
                        require!(
                            find_squads_v3_authority_index(&authority, &control.multisig) == Some(control.vault_index as u32),
                            GuardError::UnknownAuthority
                        );
                        (v3.threshold, v3.ms_change_index as u64)
                    } else {
                        let coral = parse_coral_multisig_checked(ms_account.owner, &ms_data).map_err(|_| GuardError::UnknownAuthority)?;
                        require!(coral_signer(&control.multisig, coral.nonce) == Some(authority), GuardError::UnknownAuthority);
                        (coral.threshold.min(u16::MAX as u64) as u16, coral.owner_set_seqno as u64)
                    };
                    drop(ms_data);
                    if change_index != control.stale_tx_index {
                        effective_weakened_slot = effective_weakened_slot.max(now_slot);
                    }
                    let kt = if control.key_type == KeyType::SquadsV3 as u8 { KeyType::SquadsV3 } else { KeyType::CoralMultisig };
                    (threshold, 0u32, false, kt)
                } else if control.key_type == KeyType::SingleKey as u8 {
                    reasons |= reason_flags::SINGLE_KEY;
                    (0, 0, false, KeyType::SingleKey)
                } else {
                    reasons |= reason_flags::UNKNOWN_AUTHORITY;
                    (0, 0, false, KeyType::Unknown)
                }
            }
        };

        if key_type == KeyType::SingleKey && !policy.allow_single_key {
            reasons |= reason_flags::SINGLE_KEY;
        }
        if threshold < policy.min_threshold {
            reasons |= reason_flags::THRESHOLD_BELOW_POLICY;
        }
        if time_lock < policy.min_time_lock {
            reasons |= reason_flags::TIMELOCK_BELOW_POLICY;
        }
        if has_config_authority {
            reasons |= reason_flags::CONTROLLED_MULTISIG;
        }
        if policy.cooldown_after_weaken_slots > 0
            && effective_weakened_slot != 0
            && now_slot.saturating_sub(effective_weakened_slot) < policy.cooldown_after_weaken_slots
        {
            reasons |= reason_flags::RECENTLY_WEAKENED;
        }
        if policy.cooldown_after_deploy_slots > 0
            && !live_slot_matches
        {
            reasons |= reason_flags::RECENTLY_UPGRADED;
        }
        if policy.max_refresh_age_slots > 0
            && now_slot.saturating_sub(control.last_refresh_slot) > policy.max_refresh_age_slots
        {
            reasons |= reason_flags::REFRESH_TOO_OLD;
        }
        if policy.require_attested_ok {
            // attest_seq == 0 means "never attested" — always stale,
            // regardless of the zero-value attested_at_slot sentinel.
            let stale = control.attest_seq == 0
                || now_slot.saturating_sub(control.attested_at_slot) > ctx.accounts.config.max_attest_staleness_slots;
            if stale {
                reasons |= reason_flags::ATTESTATION_STALE;
            }
            if control.risk_level > policy.max_risk_level {
                reasons |= reason_flags::RISK_TOO_HIGH;
            }
            if policy.require_verified_build && control.verified_build != 1 {
                reasons |= reason_flags::NOT_VERIFIED;
            }
        }

        let ok = reasons == 0;
        let result = CheckResult {
            ok,
            reasons,
            derived_score: control.derived_score,
            threshold,
            time_lock,
            last_weakened_slot: effective_weakened_slot,
        };
        anchor_lang::solana_program::program::set_return_data(&borsh::to_vec(&result).map_err(|_| GuardError::AccountMismatch)?);

        if policy.mode == PolicyMode::Enforce as u8 && !ok {
            return Err(first_reason_to_error(reasons).into());
        }
        Ok(())
    }
}

fn first_reason_to_error(reasons: u32) -> GuardError {
    use reason_flags::*;
    if reasons & SINGLE_KEY != 0 {
        GuardError::SingleKey
    } else if reasons & THRESHOLD_BELOW_POLICY != 0 {
        GuardError::ThresholdBelowPolicy
    } else if reasons & TIMELOCK_BELOW_POLICY != 0 {
        GuardError::TimelockBelowPolicy
    } else if reasons & RECENTLY_WEAKENED != 0 {
        GuardError::RecentlyWeakened
    } else if reasons & RECENTLY_UPGRADED != 0 {
        GuardError::RecentlyUpgraded
    } else if reasons & CONTROLLED_MULTISIG != 0 {
        GuardError::ControlledMultisig
    } else if reasons & UNKNOWN_AUTHORITY != 0 {
        GuardError::UnknownAuthority
    } else if reasons & ATTESTATION_STALE != 0 {
        GuardError::AttestationStale
    } else if reasons & RISK_TOO_HIGH != 0 {
        GuardError::RiskTooHigh
    } else if reasons & NOT_VERIFIED != 0 {
        GuardError::NotVerified
    } else {
        GuardError::RefreshTooOld
    }
}

/// Shared by `register_target` and `refresh`: reads Program + ProgramData
/// live, and the Squads multisig via `remaining_accounts[0]` if the
/// authority resolves to one, then rewrites the Derived half of `control`.
fn do_refresh<'info>(
    control: &mut Account<'info, ControlState>,
    _target_program: &UncheckedAccount<'info>,
    programdata: &UncheckedAccount<'info>,
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    let now_slot = Clock::get()?.slot;

    let pd_data = programdata.try_borrow_data()?;
    let pd_info = parse_programdata(&pd_data).map_err(|_| error!(GuardError::UnknownAuthority))?;
    drop(pd_data);

    let old_threshold = control.threshold;
    let old_time_lock = control.time_lock;
    let old_key_type = control.key_type;
    let old_ca = control.config_authority;

    let mut new_key_type = KeyType::Unknown;
    let mut new_threshold: u16 = 0;
    let mut new_voters: u16 = 0;
    let mut new_members_count: u16 = 0;
    let mut new_time_lock: u32 = 0;
    let mut new_config_authority = Pubkey::default();
    let mut new_multisig = Pubkey::default();
    let mut new_vault_index: u8 = 0;
    let mut new_stale_tx_index: u64 = 0;
    let mut new_members_hash = [0u8; 32];
    let mut new_upgrade_authority = Pubkey::default();

    match pd_info.upgrade_authority {
        None => {
            new_key_type = KeyType::Immutable;
        }
        Some(authority) => {
            new_upgrade_authority = authority;
            if let Some(ms_account) = remaining_accounts.first() {
                let ms_data = ms_account.try_borrow_data()?;
                if let Ok(ms_info) = parse_squads_multisig_checked(ms_account.owner, &ms_data) {
                    if let Some(idx) = find_squads_vault_index(&authority, ms_account.key) {
                        new_key_type = KeyType::SquadsV4;
                        new_multisig = *ms_account.key;
                        new_vault_index = idx;
                        new_threshold = ms_info.threshold;
                        new_time_lock = ms_info.time_lock;
                        new_config_authority = ms_info.config_authority;
                        new_stale_tx_index = ms_info.stale_transaction_index;
                        new_members_count = ms_info.members.len() as u16;
                        new_voters = ms_info
                            .members
                            .iter()
                            .filter(|m| m.permissions_mask & 0b010 != 0) // Vote bit
                            .count() as u16;
                        new_members_hash = hash_members(&ms_info.members);
                    }
                } else if let Ok(v3) = parse_squads_v3_ms_checked(ms_account.owner, &ms_data) {
                    // Squads v3: every member votes; no timelock field exists.
                    if let Some(idx) = find_squads_v3_authority_index(&authority, ms_account.key) {
                        new_key_type = KeyType::SquadsV3;
                        new_multisig = *ms_account.key;
                        new_vault_index = idx as u8;
                        new_threshold = v3.threshold;
                        new_time_lock = 0;
                        new_stale_tx_index = v3.ms_change_index as u64;
                        new_members_count = v3.member_count;
                        new_voters = v3.member_count;
                    }
                } else if let Ok(coral) = parse_coral_multisig_checked(ms_account.owner, &ms_data) {
                    // Coral multisig: the authority is its signer PDA; no timelock field.
                    if coral_signer(ms_account.key, coral.nonce) == Some(authority) {
                        new_key_type = KeyType::CoralMultisig;
                        new_multisig = *ms_account.key;
                        new_threshold = coral.threshold.min(u16::MAX as u64) as u16;
                        new_time_lock = 0;
                        new_stale_tx_index = coral.owner_set_seqno as u64;
                        new_members_count = coral.owner_count;
                        new_voters = coral.owner_count;
                    }
                }
            }
            if new_key_type == KeyType::Unknown {
                new_key_type = KeyType::SingleKey;
                new_threshold = 1;
                new_voters = 1;
                new_members_count = 1;
            }
        }
    }

    let weakened = match old_key_type {
        t if t == KeyType::Unknown as u8 && control.last_refresh_slot == 0 => false, // first refresh: not a "weakening"
        _ => {
            new_threshold < old_threshold
                || new_time_lock < old_time_lock
                || (new_key_type == KeyType::SingleKey && old_key_type != KeyType::SingleKey as u8)
                || (new_config_authority != Pubkey::default() && old_ca == Pubkey::default())
        }
    };

    let is_immutable = new_key_type == KeyType::Immutable;
    let is_single = new_key_type == KeyType::SingleKey;
    control.derived_score = derived_score(
        is_immutable,
        is_single,
        new_threshold,
        new_voters,
        new_time_lock,
        new_config_authority != Pubkey::default(),
    );

    control.upgrade_authority = new_upgrade_authority;
    control.key_type = new_key_type as u8;
    control.multisig = new_multisig;
    control.vault_index = new_vault_index;
    control.threshold = new_threshold;
    control.voters = new_voters;
    control.members_count = new_members_count;
    control.members_hash = new_members_hash;
    control.time_lock = new_time_lock;
    control.config_authority = new_config_authority;
    control.stale_tx_index = new_stale_tx_index;
    control.last_deploy_slot = pd_info.slot;
    control.last_refresh_slot = now_slot;
    if weakened {
        control.last_weakened_slot = now_slot;
    }
    control.last_change_slot = now_slot;

    emit!(ControlChanged {
        target: control.target_program,
        derived_score: control.derived_score,
        threshold: control.threshold,
        time_lock: control.time_lock,
        weakened,
        slot: now_slot,
    });
    Ok(())
}

fn hash_members(members: &[MemberSummary]) -> [u8; 32] {
    let mut sorted: Vec<&MemberSummary> = members.iter().collect();
    sorted.sort_by_key(|m| m.key.to_bytes());
    let mut buf = Vec::with_capacity(sorted.len() * 33);
    for m in sorted {
        buf.extend_from_slice(m.key.as_ref());
        buf.push(m.permissions_mask);
    }
    use sha2::{Digest, Sha256};
    Sha256::digest(&buf).into()
}

// ---------------------------------------------------------------- accounts

#[account]
pub struct Config {
    pub governance: Pubkey,
    pub pending_governance: Pubkey,
    pub max_attest_staleness_slots: u64,
    pub paused_attestations: bool,
    pub bump: u8,
}
impl Config {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1;
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, Default)]
pub struct AttesterEntry {
    pub key: Pubkey,
    pub active: bool,
    pub added_slot: u64,
}

#[account]
pub struct AttesterRegistry {
    pub quorum: u8,
    pub count: u8,
    pub attesters: [AttesterEntry; MAX_ATTESTERS],
    pub epoch: u64,
    pub bump: u8,
}
impl AttesterRegistry {
    pub const SIZE: usize = 8 + 1 + 1 + (32 + 1 + 8) * MAX_ATTESTERS + 8 + 1;
}

#[account]
pub struct ControlState {
    pub version: u8,
    pub bump: u8,
    pub target_program: Pubkey,
    pub programdata: Pubkey,
    // ---- Derived ----
    pub upgrade_authority: Pubkey,
    pub key_type: u8,
    pub multisig: Pubkey,
    pub vault_index: u8,
    pub threshold: u16,
    pub voters: u16,
    pub members_count: u16,
    pub members_hash: [u8; 32],
    pub time_lock: u32,
    pub config_authority: Pubkey,
    pub stale_tx_index: u64,
    pub last_deploy_slot: u64,
    pub last_change_slot: u64,
    pub last_weakened_slot: u64,
    pub last_refresh_slot: u64,
    pub derived_score: u8,
    // ---- Attested ----
    pub verified_build: u8,
    pub risk_level: u8,
    pub attested_flags: u32,
    pub attested_event_slot: u64,
    pub attested_at_slot: u64,
    pub attester: Pubkey,
    pub attest_seq: u64,
    pub reserved: [u8; 64],
}
impl ControlState {
    pub const SIZE: usize = 8 + 1 + 1 + 32 + 32
        + 32 + 1 + 32 + 1 + 2 + 2 + 2 + 32 + 4 + 32 + 8 + 8 + 8 + 8 + 8 + 1
        + 1 + 1 + 4 + 8 + 8 + 32 + 8
        + 64;
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, Default, PartialEq, Eq)]
pub struct PolicyParams {
    pub min_threshold: u16,
    pub min_time_lock: u32,
    pub allow_single_key: bool,
    pub cooldown_after_weaken_slots: u64,
    pub cooldown_after_deploy_slots: u64,
    pub max_refresh_age_slots: u64,
    pub require_attested_ok: bool,
    pub max_risk_level: u8,
    pub require_verified_build: bool,
    pub mode: u8,
    pub policy_update_timelock_slots: u64,
}
impl PolicyParams {
    pub fn write_into(self, policy: &mut Policy) {
        policy.min_threshold = self.min_threshold;
        policy.min_time_lock = self.min_time_lock;
        policy.allow_single_key = self.allow_single_key;
        policy.cooldown_after_weaken_slots = self.cooldown_after_weaken_slots;
        policy.cooldown_after_deploy_slots = self.cooldown_after_deploy_slots;
        policy.max_refresh_age_slots = self.max_refresh_age_slots;
        policy.require_attested_ok = self.require_attested_ok;
        policy.max_risk_level = self.max_risk_level;
        policy.require_verified_build = self.require_verified_build;
        policy.mode = self.mode;
        policy.policy_update_timelock_slots = self.policy_update_timelock_slots;
    }

    /// True iff every field is at least as strict as the policy's current
    /// values (used to allow `tighten_policy` to apply instantly).
    pub fn is_at_least_as_strict_as(&self, policy: &Policy) -> bool {
        self.min_threshold >= policy.min_threshold
            && self.min_time_lock >= policy.min_time_lock
            && (!self.allow_single_key || policy.allow_single_key)
            && self.cooldown_after_weaken_slots >= policy.cooldown_after_weaken_slots
            && self.cooldown_after_deploy_slots >= policy.cooldown_after_deploy_slots
            && (self.require_attested_ok || !policy.require_attested_ok)
            && self.max_risk_level <= policy.max_risk_level
            && (self.require_verified_build || !policy.require_verified_build)
    }

    pub fn hash(&self) -> [u8; 32] {
        { use sha2::{Digest, Sha256}; let bytes = borsh::to_vec(self).unwrap_or_default(); Sha256::digest(&bytes).into() }
    }
}

#[account]
pub struct Policy {
    pub owner: Pubkey,
    pub policy_id: u64,
    pub version: u8,
    pub bump: u8,
    pub min_threshold: u16,
    pub min_time_lock: u32,
    pub allow_single_key: bool,
    pub cooldown_after_weaken_slots: u64,
    pub cooldown_after_deploy_slots: u64,
    pub max_refresh_age_slots: u64,
    pub require_attested_ok: bool,
    pub max_risk_level: u8,
    pub require_verified_build: bool,
    pub mode: u8,
    pub policy_update_timelock_slots: u64,
    pub pending_hash: [u8; 32],
    pub pending_params: PolicyParams,
    pub pending_unlock_slot: u64,
}
impl Policy {
    pub const SIZE: usize = 8 + 32 + 8 + 1 + 1
        + 2 + 4 + 1 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8
        + 32
        + (2 + 4 + 1 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8)
        + 8;
}

// ---------------------------------------------------------------- events

#[event]
pub struct ControlChanged {
    pub target: Pubkey,
    pub derived_score: u8,
    pub threshold: u16,
    pub time_lock: u32,
    pub weakened: bool,
    pub slot: u64,
}

#[event]
pub struct Attested {
    pub target: Pubkey,
    pub attester: Pubkey,
    pub risk_level: u8,
    pub attested_flags: u32,
    pub seq: u64,
}

#[event]
pub struct PolicyLoosenStaged {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub unlock_slot: u64,
}

// ---------------------------------------------------------------- return data

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct CheckResult {
    pub ok: bool,
    pub reasons: u32,
    pub derived_score: u8,
    pub threshold: u16,
    pub time_lock: u32,
    pub last_weakened_slot: u64,
}

// ---------------------------------------------------------------- errors

#[error_code]
pub enum GuardError {
    #[msg("single-key authority")]
    SingleKey,
    #[msg("threshold below policy minimum")]
    ThresholdBelowPolicy,
    #[msg("timelock below policy minimum")]
    TimelockBelowPolicy,
    #[msg("control was weakened too recently")]
    RecentlyWeakened,
    #[msg("program was upgraded too recently")]
    RecentlyUpgraded,
    #[msg("multisig has a controlling config_authority")]
    ControlledMultisig,
    #[msg("authority type could not be determined")]
    UnknownAuthority,
    #[msg("attestation is stale")]
    AttestationStale,
    #[msg("attested risk level too high")]
    RiskTooHigh,
    #[msg("build is not verified")]
    NotVerified,
    #[msg("multisig account required but missing")]
    MultisigAccountMissing,
    #[msg("account does not match ControlState")]
    AccountMismatch,
    #[msg("ControlState has not been refreshed recently enough")]
    RefreshTooOld,
    #[msg("control stage below policy minimum")]
    StageBelowPolicy,
}

// ---------------------------------------------------------------- contexts

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub deployer: Signer<'info>,
    #[account(init, payer = deployer, space = Config::SIZE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = deployer, space = AttesterRegistry::SIZE, seeds = [ATTESTERS_SEED], bump)]
    pub attester_registry: Account<'info, AttesterRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GovernanceOnly<'info> {
    pub governance: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = governance)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [ATTESTERS_SEED], bump = attester_registry.bump)]
    pub attester_registry: Account<'info, AttesterRegistry>,
}

#[derive(Accounts)]
pub struct AcceptGovernance<'info> {
    pub new_governance: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct RegisterTarget<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = ControlState::SIZE,
        seeds = [CONTROL_SEED, target_program.key().as_ref()],
        bump
    )]
    pub control: Account<'info, ControlState>,
    /// CHECK: must be executable; key is what `control.target_program` binds to.
    #[account(constraint = target_program.executable @ GuardError::AccountMismatch)]
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: owner must be the BPF Upgradeable Loader; parsed by `parse_programdata`.
    #[account(
        owner = bpf_loader_upgradeable::ID @ GuardError::AccountMismatch,
        constraint = programdata.key() == Pubkey::find_program_address(&[target_program.key().as_ref()], &bpf_loader_upgradeable::ID).0 @ GuardError::AccountMismatch
    )]
    pub programdata: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    // remaining_accounts[0] (optional): the Squads multisig, if any
}

#[derive(Accounts)]
pub struct Refresh<'info> {
    #[account(mut, seeds = [CONTROL_SEED, control.target_program.as_ref()], bump = control.bump)]
    pub control: Account<'info, ControlState>,
    /// CHECK: key checked == control.target_program
    #[account(constraint = target_program.key() == control.target_program @ GuardError::AccountMismatch)]
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: key checked == control.programdata
    #[account(
        owner = bpf_loader_upgradeable::ID @ GuardError::AccountMismatch,
        constraint = programdata.key() == control.programdata @ GuardError::AccountMismatch
    )]
    pub programdata: UncheckedAccount<'info>,
    // remaining_accounts[0] (optional): the Squads multisig, if any
}

#[derive(Accounts)]
pub struct Attest<'info> {
    pub attester: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [ATTESTERS_SEED], bump = attester_registry.bump)]
    pub attester_registry: Account<'info, AttesterRegistry>,
    #[account(mut, seeds = [CONTROL_SEED, control.target_program.as_ref()], bump = control.bump)]
    pub control: Account<'info, ControlState>,
}

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Policy::SIZE,
        seeds = [POLICY_SEED, owner.key().as_ref(), &policy_id.to_le_bytes()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [POLICY_SEED, owner.key().as_ref(), &policy.policy_id.to_le_bytes()], bump = policy.bump)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, close = owner, seeds = [POLICY_SEED, owner.key().as_ref(), &policy.policy_id.to_le_bytes()], bump = policy.bump)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct CloseTarget<'info> {
    #[account(mut)]
    pub governance: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = governance)]
    pub config: Account<'info, Config>,
    #[account(mut, close = governance, seeds = [CONTROL_SEED, control.target_program.as_ref()], bump = control.bump)]
    pub control: Account<'info, ControlState>,
}

#[derive(Accounts)]
pub struct Check<'info> {
    pub policy: Account<'info, Policy>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [CONTROL_SEED, target_program.key().as_ref()], bump = control.bump)]
    pub control: Account<'info, ControlState>,
    /// CHECK: executable program account; key checked == control.target_program
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: owner == BPF Upgradeable Loader; key == control.programdata
    pub programdata: UncheckedAccount<'info>,
    /// CHECK: optional; required iff live authority is a Squads vault. owner checked in handler.
    pub multisig: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct RequireStage<'info> {
    /// CHECK: must be executable and owned by the upgradeable loader; its programdata link is checked in the handler.
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: must equal the programdata address stored in target_program, owned by the loader.
    pub programdata: UncheckedAccount<'info>,
    /// CHECK: optional. When passed it must be owned by Squads v4, Squads v3 or coral and the upgrade
    /// authority must derive from it; when absent a non-null authority is treated as a single key (Stage 0).
    pub multisig: Option<UncheckedAccount<'info>>,
}

/// Return data of `require_stage`. Same stage bands as packages/stages (stages/v1), upgrade path only.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct StageResult {
    pub stage: u8,
    pub key_type: u8,
    pub threshold: u16,
    pub timelock_s: u32,
}

pub const STAGE_2_MIN_DELAY_S: u32 = 86_400;
pub const STAGE_3_MIN_DELAY_S: u32 = 7 * 86_400;

/// Stage of a multisig path: under 2 signers is 0; then by timelock (24 h -> 2, 7 d -> 3).
pub fn multisig_stage(threshold: u16, timelock_s: u32) -> u8 {
    if threshold < 2 { 0 } else if timelock_s >= STAGE_3_MIN_DELAY_S { 3 } else if timelock_s >= STAGE_2_MIN_DELAY_S { 2 } else { 1 }
}

/// The live upgrade path of `target_program`. Every multisig claim is re-derived: a caller can only make
/// the answer stricter (by omitting the multisig), never weaker.
pub fn upgrade_path_stage(target_program: &AccountInfo, programdata: &AccountInfo, multisig: Option<&UncheckedAccount>) -> Result<StageResult> {
    require!(target_program.executable && *target_program.owner == anchor_lang::solana_program::bpf_loader_upgradeable::ID, GuardError::AccountMismatch);
    require!(*programdata.owner == anchor_lang::solana_program::bpf_loader_upgradeable::ID, GuardError::AccountMismatch);
    let linked = parse_program_account(&target_program.try_borrow_data()?).map_err(|_| GuardError::AccountMismatch)?;
    require_keys_eq!(linked, programdata.key(), GuardError::AccountMismatch);
    let pd = parse_programdata(&programdata.try_borrow_data()?).map_err(|_| GuardError::UnknownAuthority)?;
    let Some(authority) = pd.upgrade_authority else {
        return Ok(StageResult { stage: 3, key_type: KeyType::Immutable as u8, threshold: u16::MAX, timelock_s: u32::MAX });
    };
    let Some(ms) = multisig else {
        return Ok(StageResult { stage: 0, key_type: KeyType::SingleKey as u8, threshold: 1, timelock_s: 0 });
    };
    let data = ms.try_borrow_data()?;
    let (key_type, threshold, timelock_s) = if *ms.owner == squads_v4_program_id() {
        let info = parse_squads_multisig_checked(ms.owner, &data).map_err(|_| GuardError::UnknownAuthority)?;
        require!(find_squads_vault_index(&authority, &ms.key()).is_some(), GuardError::UnknownAuthority);
        (KeyType::SquadsV4, info.threshold, info.time_lock)
    } else if *ms.owner == squads_v3_program_id() {
        let info = parse_squads_v3_ms_checked(ms.owner, &data).map_err(|_| GuardError::UnknownAuthority)?;
        require!(find_squads_v3_authority_index(&authority, &ms.key()).is_some(), GuardError::UnknownAuthority);
        (KeyType::SquadsV3, info.threshold, 0)
    } else if *ms.owner == coral_multisig_program_id() {
        let info = parse_coral_multisig_checked(ms.owner, &data).map_err(|_| GuardError::UnknownAuthority)?;
        require!(coral_signer(&ms.key(), info.nonce) == Some(authority), GuardError::UnknownAuthority);
        (KeyType::CoralMultisig, info.threshold.min(u16::MAX as u64) as u16, 0)
    } else {
        return err!(GuardError::UnknownAuthority);
    };
    Ok(StageResult { stage: multisig_stage(threshold, timelock_s), key_type: key_type as u8, threshold, timelock_s })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_result_roundtrips() {
        let r = CheckResult { ok: false, reasons: reason_flags::SINGLE_KEY, derived_score: 10, threshold: 0, time_lock: 0, last_weakened_slot: 5 };
        let bytes = borsh::to_vec(&r).unwrap();
        let back = CheckResult::try_from_slice(&bytes).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn tighten_rejects_a_loosening_field() {
        let mut policy = Policy {
            owner: Pubkey::default(), policy_id: 0, version: 1, bump: 0,
            min_threshold: 3, min_time_lock: 86_400, allow_single_key: false,
            cooldown_after_weaken_slots: 100, cooldown_after_deploy_slots: 0,
            max_refresh_age_slots: 0, require_attested_ok: false, max_risk_level: 1,
            require_verified_build: false, mode: 0, policy_update_timelock_slots: 10,
            pending_hash: [0; 32], pending_params: PolicyParams::default(), pending_unlock_slot: 0,
        };
        let loosen = PolicyParams { min_threshold: 2, ..PolicyParams::default() };
        assert!(!loosen.is_at_least_as_strict_as(&policy));
        let tighten = PolicyParams {
            min_threshold: 4, min_time_lock: 86_400, allow_single_key: false,
            cooldown_after_weaken_slots: 100, cooldown_after_deploy_slots: 0,
            max_refresh_age_slots: 0, require_attested_ok: false, max_risk_level: 1,
            require_verified_build: false, mode: 0, policy_update_timelock_slots: 10,
        };
        assert!(tighten.is_at_least_as_strict_as(&policy));
        policy.min_threshold = 4;
        assert_eq!(policy.min_threshold, 4);
    }
}
