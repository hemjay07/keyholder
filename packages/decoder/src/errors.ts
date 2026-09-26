// File: packages/decoder/src/errors.ts
// Typed errors for the account byte parsers. Every parser in byte-parser.ts
// throws one of these instead of a bare Error so callers can distinguish
// "not enough bytes" from "wrong account shape".

export class DecodeError extends Error {}

export class TruncatedBufferError extends DecodeError {
  constructor(context: string, needBytes: number, haveBytes: number) {
    super(`${context}: truncated buffer, need at least ${needBytes} bytes, have ${haveBytes}`);
    this.name = 'TruncatedBufferError';
  }
}

export class DiscriminatorMismatchError extends DecodeError {
  constructor(context: string, expected: string, actual: string) {
    super(`${context}: discriminator mismatch, expected ${expected}, got ${actual}`);
    this.name = 'DiscriminatorMismatchError';
  }
}
