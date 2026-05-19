/**
 * Base class for all SDK errors.
 *
 * Carrying a stable {@link code} lets consumers branch on the failure mode
 * without string-matching the message.
 */
export class AleoSdkError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EncodingError extends AleoSdkError {
  constructor(message: string, cause?: unknown) {
    super('ALEO_ENCODING_ERROR', message, cause);
  }
}

export class ValidationError extends AleoSdkError {
  constructor(message: string, cause?: unknown) {
    super('ALEO_VALIDATION_ERROR', message, cause);
  }
}

export class WalletError extends AleoSdkError {
  constructor(message: string, cause?: unknown) {
    super('ALEO_WALLET_ERROR', message, cause);
  }
}

export class NetworkError extends AleoSdkError {
  constructor(message: string, cause?: unknown) {
    super('ALEO_NETWORK_ERROR', message, cause);
  }
}

export class TransactionError extends AleoSdkError {
  constructor(message: string, cause?: unknown) {
    super('ALEO_TRANSACTION_ERROR', message, cause);
  }
}
