//! `example-vault`: the minimal integrator from ONCHAIN.md §4/§8 — a vault
//! that CPIs `keyholder::check` (Enforce mode) before accepting a deposit.
//! Used by keyholder's LiteSVM tests to prove the CPI gate actually blocks a
//! transaction end-to-end, not just that `check` returns an error in isolation.

use anchor_lang::prelude::*;
use keyholder::cpi::accounts::Check as CpiCheck;
use keyholder::cpi::check as cpi_check;
use keyholder::program::Keyholder;
use keyholder::Policy;

declare_id!("4dj7Nu6j5sb9dzL1NRk4RRFJFXxSdt6bQzfboqZsXMNY");

#[program]
pub mod example_vault {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_deposited = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let cpi_program_id = ctx.accounts.guard_program.key();
        let cpi_accounts = CpiCheck {
            policy: ctx.accounts.guard_policy.to_account_info(),
            config: ctx.accounts.guard_config.to_account_info(),
            control: ctx.accounts.guard_control.to_account_info(),
            target_program: ctx.accounts.target_program.to_account_info(),
            programdata: ctx.accounts.target_programdata.to_account_info(),
            multisig: ctx.accounts.target_multisig.as_ref().map(|a| a.to_account_info()),
        };
        cpi_check(CpiContext::new(cpi_program_id, cpi_accounts))?;

        let vault = &mut ctx.accounts.vault;
        vault.total_deposited = vault.total_deposited.checked_add(amount).ok_or(VaultError::Overflow)?;
        emit!(Deposited { depositor: ctx.accounts.depositor.key(), amount });
        Ok(())
    }
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub total_deposited: u64,
    pub bump: u8,
}
impl Vault {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum VaultError {
    #[msg("deposit amount overflowed total")]
    Overflow,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    // pinned by address so a caller cannot swap in a lax policy
    pub guard_policy: Account<'info, Policy>,
    /// CHECK: validated inside keyholder::check
    pub guard_config: UncheckedAccount<'info>,
    /// CHECK: validated inside keyholder::check
    pub guard_control: UncheckedAccount<'info>,
    /// CHECK: must equal the market/program this vault is about to move funds into
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: validated inside keyholder::check
    pub target_programdata: UncheckedAccount<'info>,
    /// CHECK: validated inside keyholder::check, if present
    pub target_multisig: Option<UncheckedAccount<'info>>,
    pub guard_program: Program<'info, Keyholder>,
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = Vault::SIZE, seeds = [b"vault", authority.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}
