import { VeruPccVault } from '@venture23-aleo/private-gmp-sdk/contracts';
import type {
  VeruPccVaultCallOptions,
  VeruPccVaultClaimParams,
  VeruPccVaultRefundParams,
  VeruPccVaultWithdrawParams,
} from '@venture23-aleo/private-gmp-sdk/contracts';
import { AleoWalletProvider } from '@venture23-aleo/private-gmp-sdk/wallet';
import type { AleoDelegateConfig } from '@venture23-aleo/private-gmp-sdk/wallet';
import type { AleoNetwork } from '@venture23-aleo/private-gmp-sdk';

import { parseArgs, printJson, requireEnv } from '../utils.js';

// ----------------------------------------------------------------------------
// Sample params — edit these to exercise different scenarios.
//
// `walletAddress` is the address of the signing wallet (USER_ALEO_PRIVATE_KEY)
// and is injected at runtime into the fields that the on-chain transitions
// bind to `self.caller` / `self.signer`:
//   - claim:     payload.aleoBinding  (asserted by the contract)
//                receiverAddress      (sensible default; override as needed)
//   - withdraw:  fallbackReceiverAddress
//
// Everything else is a literal you should swap for real values before running
// against testnet. The `token` field on withdraw in particular MUST be a real
// `token_registry.aleo::Token` record owned by the wallet — discover one with
// `pnpm scan --mode hosted --programs token_registry.aleo`.
// ----------------------------------------------------------------------------

const WITHDRAW_DATA = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
const HUB_ADDRESS = '0x1B06762a8B9286f6A1B290579834e555a5F60557';
const HUB_CHAIN_ID = '146'; 

// Mint params for `token_registry.aleo::transfer_public_to_private` — used to
// produce a fresh Token record for the withdraw test. Requires the wallet to
// hold at least WITHDRAW_MINT_AMOUNT of WITHDRAW_TOKEN_ID in its public balance,
// and the token to already be registered.
const TOKEN_REGISTRY_PROGRAM = 'token_registry.aleo';
const TOKEN_REGISTRY_TRANSFER_FN = 'transfer_public_to_private';
const WITHDRAW_TOKEN_ID = '987654321field';
const WITHDRAW_MINT_AMOUNT = `${BigInt(1 * 10 ** 6)}u128`; // 100_000_000
const WITHDRAW_EXTERNAL_AUTH_REQUIRED = 'false';

/**
 * Convert a hex value into a 32-byte array — the `[u8; 32]` form the contract
 * sees. Shorter values (e.g. a 20-byte EVM address) are left-padded with zeros.
 * Passing this `number[]` to a `Bytes32Like` field encodes to `[12u8, 34u8, …]`.
 */
function toBytes32(hex: string): number[] {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  if (raw.length > 64) {
    throw new Error(`${hex} is longer than 32 bytes (${raw.length / 2} bytes).`);
  }
  const padded = raw.padStart(64, '0');
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16));
  }
  return bytes;
}

async function buildSampleClaimParams(
  network: AleoNetwork,
): Promise<VeruPccVaultClaimParams> {
  const payload = {
    sourceChainId: '6694886634403', // veru_pcc_vault.aleo::ALEO_CHAIN_ID
    sourceTokenId: '123',
    sourceAmount: '100',
    aleoBinding: "aleo1gxujeavgxca0t3x27chyrvsxflwtfejs2pajr7czyerre9ltyy8sd7ghx0", // self.caller assertion
    destinationTokenId: '123',
    nonce: '134',
  };
  // The on-chain `claim` recomputes BHP256::hash_to_field(payload) and asserts
  // it equals the commitment we pass. Match that derivation locally so the
  // sync assertion passes — the finalize step still requires a relayer to
  // have populated `commitments[hash]` via `recv_message`, otherwise the
  // mapping read panics. Print the hash so you can drive `recv_message` with
  // the same value before retrying claim.
  const expectedCommitmentHash = await VeruPccVault.computePayloadCommitmentHash(
    payload,
    network,
  );
  // Log the hex form so you can drive `recv_message` with the same commitment.
  console.log('payload commitment (hex):', Buffer.from(expectedCommitmentHash).toString('hex'));

  return {
    payload,
    receiverAddress: "aleo1fg8y0ax9g0yhahrknngzwxkpcf7ejy3mm6cent4mmtwew5ueps8s6jzl27",
    claimableAmount: '100',
    // `Bytes32Like` accepts the Uint8Array directly — no hex round-trip needed.
    expectedCommitmentHash,
  };
}

/**
 * Mint a fresh `token_registry.aleo::Token` record into the wallet by calling
 * `transfer_public_to_private(token_id, recipient, amount, external_auth)`, then
 * pull the decrypted plaintext record literal out of the confirmed transaction.
 * The returned string is suitable as the `token` input to `withdraw`.
 */
async function mintTokenRecord(wallet: AleoWalletProvider): Promise<string> {
  const recipient = await wallet.getAddress();
  const { result } = await wallet.executeAndWait({
    programName: TOKEN_REGISTRY_PROGRAM,
    functionName: TOKEN_REGISTRY_TRANSFER_FN,
    inputs: [WITHDRAW_TOKEN_ID, recipient, WITHDRAW_MINT_AMOUNT, WITHDRAW_EXTERNAL_AUTH_REQUIRED],
  });
  const owned = await wallet.getOwnedRecordsFromTransaction(result.transactionId);
  const tokenRecord = owned[0];
  if (!tokenRecord) {
    throw new Error(
      `No owned records found in ${TOKEN_REGISTRY_PROGRAM}/${TOKEN_REGISTRY_TRANSFER_FN} tx ${result.transactionId} — check the wallet's public balance for ${WITHDRAW_TOKEN_ID} and that the token is registered.`,
    );
  }
  return tokenRecord;
}

async function buildSampleWithdrawParams(
  wallet: AleoWalletProvider,
  network: AleoNetwork,
): Promise<VeruPccVaultWithdrawParams> {
  const walletAddress = await wallet.getAddress();
  // Mint a real Token record (token_id 987654321field) so withdraw has a
  // private input to consume, rather than a hand-written literal.
  const token = await mintTokenRecord(wallet);
  const nonce = BigInt(Math.floor(Math.random() * 93407655373) + 1);
  // The on-chain `withdraw` derives the `withdraw_commitment` key the same way
  // `claim` derives its commitment — BHP256 over a Payload-shaped struct (see
  // VeruPccVault.computePayloadCommitmentHash). Match that derivation locally so
  // the SDK's pre-flight "slot is free" check uses the same key the contract
  // writes. Swap these payload fields for the real ones your `withdraw`
  // derivation uses before running against testnet.
  const expectedCommitmentHash = await VeruPccVault.computePayloadCommitmentHash(
    {
      sourceChainId: '6694886634403', // veru_pcc_vault.aleo::ALEO_CHAIN_ID
      sourceTokenId: WITHDRAW_TOKEN_ID.replace(/u128$|field$/, ''),
      sourceAmount: '100',
      aleoBinding: walletAddress,
      destinationTokenId: WITHDRAW_TOKEN_ID.replace(/u128$|field$/, ''),
      nonce: nonce.toString(),
    },
    network,
  );
  console.log(
    'withdraw commitment (hex):',
    Buffer.from(expectedCommitmentHash).toString('hex'),
  );
  return {
    token,
    // Uint → bigint
    connSn: BigInt(Math.floor(Math.random() * 93407655373) + 1),
    // Bytes32Like → [u8; 32] byte array (the contract form)
    data: toBytes32(WITHDRAW_DATA),
    // Uint → bigint
    feeAmount: 0n,
    // number — basis points (0–10000)
    feeBpsParam: 0,
    // Uint → bigint
    amountSend: 100n,
    hubChainId: BigInt(HUB_CHAIN_ID),
    // Bytes32Like — EVM address is 20 bytes, left-padded to 32
    hubAddress: toBytes32(HUB_ADDRESS),
    destReceiverAddrs: toBytes32(WITHDRAW_DATA),
    // FieldLike → bigint
    nonce,
    // string — Aleo address
    fallbackReceiverAddress: walletAddress,
    // Uint → bigint
    gmpFee: 0n,
    // Bytes32Like — the withdraw_commitment key the SDK pre-flights against.
    expectedCommitmentHash,
  };
}

// Sample params for `refund(source_token_id, source_amount, nonce)`. These must
// match an outbound intent the wallet previously submitted via `withdraw` —
// the triple identifies which intent's funds to reclaim. Swap for real values
// before running against testnet.
async function buildSampleRefundParams(
  wallet: AleoWalletProvider,
  network: AleoNetwork,
): Promise<VeruPccVaultRefundParams> {
  const walletAddress = await wallet.getAddress();
  // FieldLike → bigint. Must match the nonce of the original withdraw whose
  // commitment we're refunding.
  const nonce = BigInt(Math.floor(Math.random() * 93407655373) + 1);
  // Recompute the same commitment hash the original `withdraw` derived (see
  // buildSampleWithdrawParams). The SDK's pre-flight refund check reads
  // withdraw_commitment[hash] and only proceeds if intent_status == FAILED.
  // Swap these payload fields for the real intent's before running.
  const expectedCommitmentHash = await VeruPccVault.computePayloadCommitmentHash(
    {
      sourceChainId: '6694886634403', // veru_pcc_vault.aleo::ALEO_CHAIN_ID
      sourceTokenId: WITHDRAW_TOKEN_ID.replace(/u128$|field$/, ''),
      sourceAmount: '100',
      aleoBinding: walletAddress,
      destinationTokenId: WITHDRAW_TOKEN_ID.replace(/u128$|field$/, ''),
      nonce: nonce.toString(),
    },
    network,
  );
  return {
    // FieldLike → bigint
    sourceTokenId: BigInt(WITHDRAW_TOKEN_ID.replace(/u128$|field$/, '')),
    // Uint → bigint
    sourceAmount: 100n,
    nonce,
    // Bytes32Like — the withdraw_commitment key the SDK pre-flights against.
    expectedCommitmentHash,
  };
}

// pnpm vault-claim [--priority 0] [--private-fee false] [--wait true] [--delegate [url]]
//
// Calls `veru_pcc_vault.aleo/claim` via VeruPccVault with the embedded sample
// params (see buildSampleClaimParams above). The wallet (USER_ALEO_PRIVATE_KEY)
// must equal payload.aleoBinding — the on-chain transition enforces
// `self.caller == payload.aleo_binding`, so aleoBinding is auto-filled with
// the wallet's address.
export async function runVaultClaim(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const callOptions = readCallOptions(args);
  const wait = readWait(args.flags['wait']);
  const network = readNetwork();

  const wallet = buildWallet(readDelegateConfig(args.flags['delegate']), network);
  const address = await wallet.getAddress();
  const vault = new VeruPccVault(wallet);
  const params = await buildSampleClaimParams(network);
  if (!wait) {
    const result = await vault.claim(params, callOptions);
    printJson({ ok: true, action: 'claim', address, params, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await vault.claimAndWait(params, callOptions);
  printJson({
    ok: true,
    action: 'claim',
    address,
    params,
    transactionId: result.transactionId,
    receipt: serializeReceipt(receipt),
  });
}

// pnpm vault-withdraw [--priority 0] [--private-fee false] [--wait true] [--delegate [url]]
//
// Calls `veru_pcc_vault.aleo/withdraw` via VeruPccVault with the embedded
// sample params (see buildSampleWithdrawParams above). The wallet must own
// the token record referenced by params.token — edit the sample with a real
// record literal before running.
export async function runVaultWithdraw(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const callOptions = readCallOptions(args);
  const wait = readWait(args.flags['wait']);

  const network = readNetwork();
  const wallet = buildWallet(readDelegateConfig(args.flags['delegate']), network);
  const address = await wallet.getAddress();
  const vault = new VeruPccVault(wallet);
  const params = await buildSampleWithdrawParams(wallet, network);
  // return;
  if (!wait) {
    const result = await vault.withdraw(params, callOptions);
    printJson({ ok: true, action: 'withdraw', address, params, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await vault.withdrawAndWait(params, callOptions);
  printJson({
    ok: true,
    action: 'withdraw',
    address,
    params,
    transactionId: result.transactionId,
    receipt: serializeReceipt(receipt),
  });
}

// pnpm vault-refund [--priority 0] [--private-fee false] [--wait true] [--delegate [url]]
//
// Calls `veru_pcc_vault.aleo/refund` via VeruPccVault with the embedded sample
// params (see buildSampleRefundParams above). The (source_token_id,
// source_amount, nonce) triple must match an outbound intent the wallet
// previously submitted via withdraw — edit the sample before running.
export async function runVaultRefund(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const callOptions = readCallOptions(args);
  const wait = readWait(args.flags['wait']);

  const network = readNetwork();
  const wallet = buildWallet(readDelegateConfig(args.flags['delegate']), network);
  const address = await wallet.getAddress();
  const vault = new VeruPccVault(wallet);
  const params = await buildSampleRefundParams(wallet, network);
  if (!wait) {
    const result = await vault.refund(params, callOptions);
    printJson({ ok: true, action: 'refund', address, params, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await vault.refundAndWait(params, callOptions);
  printJson({
    ok: true,
    action: 'refund',
    address,
    params,
    transactionId: result.transactionId,
    receipt: serializeReceipt(receipt),
  });
}

function readNetwork(): AleoNetwork {
  return (process.env.ALEO_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
}

function buildWallet(
  delegate: AleoDelegateConfig | undefined,
  network: AleoNetwork,
): AleoWalletProvider {
  const rpcUrl = process.env.ALEO_API_HOST ?? 'https://api.provable.com/v2';
  const privateKey = requireEnv('USER_ALEO_PRIVATE_KEY');
  return new AleoWalletProvider({
    network,
    rpcUrl,
    privateKey,
    ...(delegate && { delegate }),
  });
}

function readCallOptions(args: ReturnType<typeof parseArgs>): VeruPccVaultCallOptions {
  const priorityFee = Number(args.flags['priority'] ?? 0);
  const privateFee =
    (args.flags['private-fee'] as string | true | undefined)?.toString().toLowerCase() === 'true';
  return { priorityFee, privateFee };
}

function readWait(flag: string | string[] | true | undefined): boolean {
  return flag?.toString().toLowerCase() !== 'false';
}

function readDelegateConfig(
  flag: string | string[] | true | undefined,
): AleoDelegateConfig | undefined {
  if (flag === undefined) return undefined;
  const url = typeof flag === 'string' ? flag : (process.env.PROVER_URL ?? '');
  if (!url) {
    throw new Error('--delegate requires either an explicit URL or PROVER_URL in the env.');
  }
  const dpsPrivacyEnv = process.env.PROVER_DPS_PRIVACY;
  return {
    url,
    ...(process.env.PROVER_API_KEY !== undefined && { apiKey: process.env.PROVER_API_KEY }),
    ...(process.env.PROVER_CONSUMER_ID !== undefined && { consumerId: process.env.PROVER_CONSUMER_ID }),
    ...(dpsPrivacyEnv !== undefined && { dpsPrivacy: dpsPrivacyEnv.toLowerCase() !== 'false' }),
  };
}

function serializeReceipt(receipt: {
  status: string;
  type: string;
  index: bigint;
  confirmedAt: Date;
}): Record<string, unknown> {
  return {
    status: receipt.status,
    type: receipt.type,
    index: receipt.index,
    confirmedAt: receipt.confirmedAt.toISOString(),
  };
}
