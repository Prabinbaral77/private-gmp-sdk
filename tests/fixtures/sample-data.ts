import type { AleoAddress } from '@/types/aleo';
import type { ProgramAbi } from '@/types/program';

export const SAMPLE_ADDRESS = ('aleo1' + 'a'.repeat(58)) as AleoAddress;
export const SAMPLE_RECIPIENT = ('aleo1' + 'b'.repeat(58)) as AleoAddress;

export const CREDITS_ABI: ProgramAbi = {
  id: 'credits.aleo',
  functions: [
    {
      name: 'transfer_public',
      inputs: [
        { name: 'recipient', type: 'address', visibility: 'public' },
        { name: 'amount', type: 'u64', visibility: 'public' },
      ],
      outputs: [{ type: 'future', visibility: 'public' }],
    },
    {
      name: 'mint_public',
      inputs: [
        { name: 'recipient', type: 'address', visibility: 'public' },
        { name: 'amount', type: 'u64', visibility: 'public' },
      ],
      outputs: [],
    },
  ],
};
