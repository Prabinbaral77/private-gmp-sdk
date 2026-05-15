/**
 * Internal shapes for the `@provablehq/sdk` peer dependency.
 *
 * Not re-exported from {@link ./index}; consumed only by
 * {@link ../derivation/account}.
 */

export type ProvableHqAccount = {
  privateKey(): { to_string(): string };
  viewKey(): { to_string(): string };
  address(): { to_string(): string };
  sign(message: Uint8Array): { to_string(): string };
};

export type ProvableHqAccountCtor = {
  new (init?: { seed?: Uint8Array; privateKey?: string }): ProvableHqAccount;
};

export type ProvableHqModule = {
  Account: ProvableHqAccountCtor;
};
