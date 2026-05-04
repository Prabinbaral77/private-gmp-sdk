/**
 * Golden vectors for {@link deriveAleoSeed}.
 *
 * These pin the byte-stable contract of seed derivation. If any of them
 * change, every existing user re-deriving an Aleo account from a foreign
 * signature would land on a different address — i.e. it's a breaking change
 * and the {@link DEFAULT_DOMAIN_SEPARATOR} / {@link DEFAULT_HKDF_INFO_UTF8}
 * constants must be bumped.
 */
export const DOMAIN_SALT_HEX_DEFAULT =
  '1ed2b29e1e0a67b6774b7e311e346ad44a1bfac60299ca15ac432a8b61dd9b49';

export const SEED_VECTORS = [
  {
    name: 'solana / short signature / short message',
    chain: 'solana' as const,
    signerId: 'abc123',
    signatureBytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    message: 'hello',
    expectedHex: 'b7affe42465d0838a55257bd0bae0f73f5dece0262ef76fbe4403f25ce16ef13',
  },
  {
    name: 'evm / mixed-case signerId is normalised to lowercase',
    chain: 'evm' as const,
    signerId: '0xDEADBEEF',
    signatureBytes: new Uint8Array([0xff, 0x00, 0xaa]),
    message: 'Sign to derive deterministic Aleo wallet',
    expectedHex: '99fb8e49e6e9fbb41e1f2a45adeb3e5649767422a477fc28bbaba06e0f61f5cd',
  },
  {
    name: 'sui / 64-byte signature / empty message',
    chain: 'sui' as const,
    signerId: '0x1111',
    signatureBytes: new Uint8Array(64).fill(0x42),
    message: '',
    expectedHex: 'c91545a661758da4ade4253d6bee8cb248118295d9da508e9d5d18b7195067b1',
  },
];

/** Deterministic source-key fixtures for round-trip signer tests. */
export const SUI_TEST_SEED = new Uint8Array(32).fill(0x42);
export const SUI_TEST_SEED_HEX = '42'.repeat(32);
export const SUI_TEST_PUBKEY_HEX =
  '2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12';
export const SUI_TEST_ADDRESS =
  '0x8762edc232897de062e032fa4a9a7d1819091b9238225044f497e027110c671a';
export const SUI_TEST_SIG_HEX_FOR_TEST_MESSAGE =
  'dce1c6d4a0998fb0083b61a4c4cba51c8f108e00bb1cf70e28cf533a476b804e81ace8a4d64b58138b1e498acf9d871728eecd4ad2541b942921879e02a04001';

export const SOLANA_TEST_ADDRESS = '2btLJAAb1S3x6hZYdVyAePjqtQYi2ZBSRGy4569RZu8h';
export const SOLANA_TEST_SIG_HEX_FOR_TEST_MESSAGE =
  '9905d4c66b0551159baaf037b4706f470d119909870e43c8ddc5562fb44f58a95db58a04905a884c1ecb645a307158f16a3711355ff1ade6fd74221711ab240e';
export const EVM_TEST_SIG_HEX_FOR_TEST_MESSAGE =
  '0x77a3f014373ba85f96a3d55d609bf704cffd6c72b31baf657389112b10add9ca4219eda400354df5fb1daa9861aa6e9fb028fd4d9806cccf5f43f65edb305d7a1b';

export const TEST_MESSAGE = 'test message';

//Required  
export const EVM_TEST_PRIVATE_KEY = '0xe3b7bcecfeeb0ff63fc7284eb98d8f008883e9fad20fa2c2785f1e81a9474584';
export const SOLANA_TEST_SECRET_KEY_B64 = "2E4BqZMU1VUhnCcErcCdbL9Pq1rrUi2RwLTJRCZwN4PAzspTEKVoxZ9bEyFgdrE1qMedDUxneXzB5PokhZnfGeqT"
export const EVM_TEST_ADDRESS = '0xd63de8F3700966CeB68f35DD0CFB6Bc24d3f17B9';
export const SUI_PRIVATE_KEY_HEX = '57d6fa581ef742a798009c479e07f584bb9681b230b86119dd44cd5470ec1110';
export const STELLAR_PRIVATE_KEY = 'SAX4IS3E66L53ULUSRHSK6BEEBWGZXRN4TQPTBJHEGOBAULBY7VBH2NJ'
export const BITCOIN_PRIVATE_KEY = 'L4FGifmePyYYUgfkMTf56ajmTbVj3ZKp1BEPK6No7VpNuXjRcnDs';
export const STACKS_PRIVATE_KEY ='8471e6341dec3ea46e4ed0fadc29282172d888b4d77fbfd2a7f5397d1772054501';

