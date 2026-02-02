import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

describe("anchor_vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const user = provider.wallet.publicKey;

  // Derive PDAs
  const [vaultStatePda, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), user.toBuffer()],
    program.programId
  );

  const [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), vaultStatePda.toBuffer()],
    program.programId
  );

  before(async () => {
    // Airdrop for fees 
    await provider.connection.requestAirdrop(user, 10 * anchor.web3.LAMPORTS_PER_SOL);
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it("Initialize the vault", async () => {
    await program.methods
      .initialize()
      .accountsStrict({
        user: user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    expect(vaultState.vaultBump).to.equal(vaultBump);
    expect(vaultState.stateBump).to.equal(stateBump);

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    expect(vaultBalance).to.equal(rentExempt);
  });

  it("Deposit SOL into the vault", async () => {
    const depositAmount = 1 * anchor.web3.LAMPORTS_PER_SOL; // 1 SOL

    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialUserBalance = await provider.connection.getBalance(user);

    await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accountsStrict({
        user: user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    const finalUserBalance = await provider.connection.getBalance(user);

    expect(finalVaultBalance).to.equal(initialVaultBalance + depositAmount);
    // User balance decreases by amount - fees
    expect(finalUserBalance).to.equal(initialUserBalance - depositAmount - 5000);
  });

  it("Withdraw SOL from the vault", async () => {
    const withdrawAmount = 0.5 * anchor.web3.LAMPORTS_PER_SOL; // 0.5 SOL

    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialUserBalance = await provider.connection.getBalance(user);

    await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accountsStrict({
        user: user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const finalVaultBalance = await provider.connection.getBalance(vaultPda);
    const finalUserBalance = await provider.connection.getBalance(user);

    expect(finalVaultBalance).to.equal(initialVaultBalance - withdrawAmount);
    // User balance increases by amount - fees
    expect(finalUserBalance).to.equal(initialUserBalance + withdrawAmount - 5000);
  });

  it("Close the vault", async () => {
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialVaultStateBalance = await provider.connection.getBalance(vaultStatePda);
    const initialUserBalance = await provider.connection.getBalance(user);

    await program.methods
      .close()
      .accountsStrict({
        user: user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const finalUserBalance = await provider.connection.getBalance(user);

    // Vault should be 0
    expect(await provider.connection.getBalance(vaultPda)).to.equal(0);

    // VaultState should be closed (null)
    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePda);
    expect(vaultStateInfo).to.be.null;

    // User gets back the remaining balance - fees
    expect(finalUserBalance).to.equal(initialUserBalance + initialVaultBalance + initialVaultStateBalance - 5000);
  });
});

describe("anchor_vault - extended tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const user = provider.wallet.publicKey;

  const [vaultStatePda, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), user.toBuffer()],
    program.programId
  );

  const [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), vaultStatePda.toBuffer()],
    program.programId
  );

  const otherUser = Keypair.generate();

  const [otherVaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), otherUser.publicKey.toBuffer()],
    program.programId
  );

  const [otherVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), otherVaultStatePda.toBuffer()],
    program.programId
  );

  before(async () => {
    await provider.connection.requestAirdrop(user, 10 * LAMPORTS_PER_SOL);
    const sig = await provider.connection.requestAirdrop(otherUser.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
  });

  // Re-initialize after the first describe block closed the vault
  it("Initialize the vault", async () => {
    await program.methods
      .initialize()
      .accountsStrict({
        user,
        vaultState: vaultStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("Fails to initialize the same vault twice", async () => {
    try {
      await program.methods
        .initialize()
        .accountsStrict({
          user,
          vaultState: vaultStatePda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown -- vault already initialized");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Deposit of 0 lamports succeeds (no-op transfer)", async () => {
    const balanceBefore = await provider.connection.getBalance(vaultPda);

    await program.methods
      .deposit(new anchor.BN(0))
      .accountsStrict({
        user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const balanceAfter = await provider.connection.getBalance(vaultPda);
    expect(balanceAfter).to.equal(balanceBefore);
  });


  it("Fails to withdraw more than vault balance", async () => {
    const vaultBalance = await provider.connection.getBalance(vaultPda);

    try {
      await program.methods
        .withdraw(new anchor.BN(vaultBalance + 1 * LAMPORTS_PER_SOL))
        .accountsStrict({
          user,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown -- insufficient vault funds");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Withdraw of 0 lamports succeeds (no-op transfer)", async () => {
    const balanceBefore = await provider.connection.getBalance(vaultPda);

    await program.methods
      .withdraw(new anchor.BN(0))
      .accountsStrict({
        user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const balanceAfter = await provider.connection.getBalance(vaultPda);
    expect(balanceAfter).to.equal(balanceBefore);
  });

  it("Fails when a different user tries to withdraw from the vault", async () => {
    try {
      await program.methods
        .withdraw(new anchor.BN(1000))
        .accountsStrict({
          user: otherUser.publicKey,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherUser])
        .rpc();
      expect.fail("Should have thrown -- wrong signer for vault_state seeds");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Fails when a different user tries to close the vault", async () => {
    try {
      await program.methods
        .close()
        .accountsStrict({
          user: otherUser.publicKey,
          vault: vaultPda,
          vaultState: vaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherUser])
        .rpc();
      expect.fail("Should have thrown -- wrong signer for vault_state seeds");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Fails to deposit after vault is closed", async () => {
    try {
      await program.methods
        .deposit(new anchor.BN(1000))
        .accountsStrict({
          user: otherUser.publicKey,
          vault: otherVaultPda,
          vaultState: otherVaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherUser])
        .rpc();
      expect.fail("Should have thrown -- vault_state account is closed");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Fails to withdraw after vault is closed", async () => {
    try {
      await program.methods
        .withdraw(new anchor.BN(1000))
        .accountsStrict({
          user: otherUser.publicKey,
          vault: otherVaultPda,
          vaultState: otherVaultStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherUser])
        .rpc();
      expect.fail("Should have thrown -- vault_state account is closed");
    } catch (_err) {
      // Transaction correctly rejected
    }
  });

  it("Closing primary vault returns all funds", async () => {
    const userBalBefore = await provider.connection.getBalance(user);
    const vaultBal = await provider.connection.getBalance(vaultPda);
    const stateBal = await provider.connection.getBalance(vaultStatePda);

    await program.methods
      .close()
      .accountsStrict({
        user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    expect(await provider.connection.getBalance(vaultPda)).to.equal(0);
    expect(await provider.connection.getAccountInfo(vaultStatePda)).to.be.null;

    const userBalAfter = await provider.connection.getBalance(user);
    expect(userBalAfter).to.be.closeTo(userBalBefore + vaultBal + stateBal, 10000);
  });
});
