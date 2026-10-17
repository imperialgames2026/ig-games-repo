use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("11111111111111111111111111111111");

// This is a non-custodial configuration scaffold. The placeholder program ID
// MUST be replaced after generating a deployment keypair on Devnet.
// No stake transfers, rewards, or withdrawals are implemented or enabled.

#[program]
pub mod imperial_staking {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, epoch_duration: i64, reserve_floor: u64) -> Result<()> {
        require!(epoch_duration >= 3600 && epoch_duration <= 86400, StakingError::InvalidEpoch);
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.mint = ctx.accounts.mint.key();
        pool.staking_vault = ctx.accounts.staking_vault.key();
        pool.rake_vault = ctx.accounts.rake_vault.key();
        pool.total_staked = 0;
        pool.total_weighted_staked = 0;
        pool.epoch_duration = epoch_duration;
        pool.last_epoch_timestamp = Clock::get()?.unix_timestamp;
        pool.current_epoch = 0;
        pool.reserve_floor = reserve_floor;
        pool.is_paused = true; // No funds may move until reviewed instructions are implemented.
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminPool>, paused: bool) -> Result<()> {
        ctx.accounts.pool.is_paused = paused;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolState::INIT_SPACE,
        seeds = [b"pool", mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, PoolState>,
    #[account(
        constraint = staking_vault.mint == mint.key() @ StakingError::WrongMint,
        constraint = staking_vault.owner == pool.key() @ StakingError::WrongVaultAuthority
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    #[account(
        constraint = rake_vault.mint == mint.key() @ StakingError::WrongMint,
        constraint = rake_vault.owner == pool.key() @ StakingError::WrongVaultAuthority,
        constraint = rake_vault.key() != staking_vault.key() @ StakingError::DuplicateVault
    )]
    pub rake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminPool<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub pool: Account<'info, PoolState>,
}

#[account]
#[derive(InitSpace)]
pub struct PoolState {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub staking_vault: Pubkey,
    pub rake_vault: Pubkey,
    pub total_staked: u64,
    pub total_weighted_staked: u64,
    pub epoch_duration: i64,
    pub last_epoch_timestamp: i64,
    pub current_epoch: u64,
    pub reserve_floor: u64,
    pub is_paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LockTier {
    Flexible,
    Day1,
    Days7,
    Days30,
}

impl LockTier {
    pub fn multiplier_bps(&self) -> u64 {
        match self {
            Self::Flexible => 10_000,
            Self::Day1 => 12_500,
            Self::Days7 => 15_000,
            Self::Days30 => 20_000,
        }
    }
}

#[account]
pub struct UserStake {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub amount_staked: u64,
    pub weighted_amount: u64,
    pub lock_tier: LockTier,
    pub staked_at_timestamp: i64,
    pub lock_expiry_timestamp: i64,
    pub last_claimed_epoch: u64,
}

#[error_code]
pub enum StakingError {
    #[msg("Epoch duration must be between 1 hour and 1 day")]
    InvalidEpoch,
    #[msg("Token account has wrong mint")]
    WrongMint,
    #[msg("Token vault must be controlled by pool PDA")]
    WrongVaultAuthority,
    #[msg("Staking and rake vaults must differ")]
    DuplicateVault,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lock_tiers_match_blueprint() {
        assert_eq!(LockTier::Flexible.multiplier_bps(), 10_000);
        assert_eq!(LockTier::Day1.multiplier_bps(), 12_500);
        assert_eq!(LockTier::Days7.multiplier_bps(), 15_000);
        assert_eq!(LockTier::Days30.multiplier_bps(), 20_000);
    }
}
