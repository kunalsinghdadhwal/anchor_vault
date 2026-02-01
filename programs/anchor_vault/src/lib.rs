use anchor_lang::prelude::*;

declare_id!("EeDxaFVqGEAeXE3YxFdMUjNCSfNBguVL3ZZq9AC1yUme");

#[program]
pub mod anchor_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
