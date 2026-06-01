import { VeruPccVault } from '@venture23-aleo/private-gmp-sdk/contracts';
import type {
  VeruPccVaultCallOptions,
  VeruPccVaultClaimParams,
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

const BYTES32_ZERO = '0xF94F367CA34A89CE51D008C2BCFBA7800BC08717';
const WITHDRAW_DATA = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

async function buildSampleClaimParams(
  walletAddress: string,
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
  const expectedCommitmentBytes = await VeruPccVault.computePayloadCommitmentHash(
    payload,
    network,
  );
  let expectedCommitmentHex = Buffer.from(expectedCommitmentBytes).toString("hex");
  
  return {
    payload,
    receiverAddress: "aleo1fg8y0ax9g0yhahrknngzwxkpcf7ejy3mm6cent4mmtwew5ueps8s6jzl27",
    claimableAmount: '100',
    expectedCommitmentHash: expectedCommitmentHex,
  };
}

async function buildSampleWithdrawParams(walletAddress: string): Promise<VeruPccVaultWithdrawParams> {
  return {
    // Replace with a real token_registry.aleo::Token record literal from your wallet.
    token: `{ owner: ${walletAddress}.private, token_id: 1field.private, amount: 1000u128.private, external_authorization_required: false.private, authorized_until: 0u32.private, _nonce: 1234group.public }`,
    connSn: '1',
    data: WITHDRAW_DATA,
    feeAmount: '10',
    feeBpsParam: 100,
    amountSend: '1000',
    hubChainId: '1',
    hubAddress: WITHDRAW_DATA,
    destReceiverAddrs: WITHDRAW_DATA,
    nonce: '1',
    fallbackReceiverAddress: walletAddress,
    gmpFee: '0',
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
  const params = await buildSampleClaimParams(address, network);
  if (!wait) {
    const result = await vault.claim(params, callOptions);
    printJson({ action: 'claim', address, params, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await vault.claimAndWait(params, callOptions);
  printJson({
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
  const params = await buildSampleWithdrawParams(address);

  if (!wait) {
    const result = await vault.withdraw(params, callOptions);
    printJson({ action: 'withdraw', address, params, ...result, confirmed: false });
    return;
  }

  const { result, receipt } = await vault.withdrawAndWait(params, callOptions);
  printJson({
    action: 'withdraw',
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
