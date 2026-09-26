// File: packages/decoder/src/anchor-decoder.ts
// [TESTED against real mainnet instructions, 2026-09-26]
//
// Generic, IDL-driven Anchor instruction decoder. Handles two IDL shapes
// seen on real mainnet accounts (see idl-loader.ts):
//   - "legacy" (the shape Anchor's legacy IDL account and older CLIs write):
//     top-level `name`, camelCase instruction/field names, primitive type
//     `"publicKey"`, `{"defined": "TypeName"}`. No embedded discriminator —
//     it must be computed as sha256(`global:<snake_case name>`)[..8], which
//     this file verified byte-for-byte against six real Squads v4
//     instructions and one real Drift admin instruction (see
//     anchor-decoder.test.ts).
//   - "new spec" (0.1.0, the shape Program Metadata canonical IDLs use):
//     `metadata.name`, snake_case names already, primitive type
//     `"pubkey"`, `{"defined": {"name": "TypeName"}}`, and each instruction
//     carries its own `discriminator: number[]` — no computation needed.
// Borsh-style decoding, hand-written (no @coral-xyz/anchor dependency, to
// match this package's existing hand-written parsers in byte-parser.ts).

import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import { DecodeError } from './errors';

export type AnchorIdl = Record<string, any>;

export interface DecodedInstruction {
  programId: string;
  name: string;
  args: Record<string, unknown>;
  discriminatorHex: string;
}

export type AnchorDecodeResult =
  | { kind: 'decoded'; ix: DecodedInstruction }
  | { kind: 'undecoded'; reason: string; programId: string; dataHex: string };

export class IdlTypeError extends DecodeError {}

// ── Name / discriminator helpers ────────────────────────────────────────────

export function camelToSnake(name: string): string {
  return name.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}

export function instructionDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${camelToSnake(name)}`).digest().subarray(0, 8);
}

export function idlName(idl: AnchorIdl): string | undefined {
  return idl.name ?? idl.metadata?.name;
}

function ixDiscriminator(ixDef: Record<string, any>): Buffer {
  if (Array.isArray(ixDef.discriminator)) return Buffer.from(ixDef.discriminator as number[]);
  return instructionDiscriminator(ixDef.name as string);
}

export function findInstructionByDiscriminator(idl: AnchorIdl, discriminator: Buffer): Record<string, any> | null {
  const instructions: Record<string, any>[] = idl.instructions ?? [];
  for (const ixDef of instructions) {
    if (ixDiscriminator(ixDef).equals(discriminator)) return ixDef;
  }
  return null;
}

// ── Type normalization (bridges legacy vs new-spec IDL shapes) ─────────────

type NormalizedType =
  | { kind: 'primitive'; name: string }
  | { kind: 'vec'; inner: NormalizedType }
  | { kind: 'option'; inner: NormalizedType }
  | { kind: 'array'; inner: NormalizedType; len: number }
  | { kind: 'defined'; name: string };

function normalizeType(type: unknown): NormalizedType {
  if (typeof type === 'string') return { kind: 'primitive', name: type };
  if (type && typeof type === 'object') {
    const t = type as Record<string, unknown>;
    if ('vec' in t) return { kind: 'vec', inner: normalizeType(t.vec) };
    if ('option' in t) return { kind: 'option', inner: normalizeType(t.option) };
    if ('array' in t) {
      const [inner, len] = t.array as [unknown, number];
      return { kind: 'array', inner: normalizeType(inner), len };
    }
    if ('defined' in t) {
      const defined = t.defined;
      const name = typeof defined === 'string' ? defined : (defined as { name: string }).name;
      return { kind: 'defined', name };
    }
  }
  throw new IdlTypeError(`unrecognized IDL type shape: ${JSON.stringify(type)}`);
}

function findTypeDef(idl: AnchorIdl, name: string): Record<string, any> {
  const found = (idl.types ?? []).find((t: Record<string, any>) => t.name === name);
  if (!found) throw new IdlTypeError(`type "${name}" not found in idl.types`);
  return found;
}

function isNamedFields(fields: unknown[]): boolean {
  return fields.length > 0 && typeof fields[0] === 'object' && fields[0] !== null && 'name' in (fields[0] as object);
}

// ── Cursor-based value decoding ──────────────────────────────────────────────

class Cursor {
  offset = 0;
  constructor(readonly buf: Buffer) {}
  need(n: number, context: string) {
    if (this.offset + n > this.buf.length) {
      throw new IdlTypeError(`${context}: need ${n} bytes at offset ${this.offset}, have ${this.buf.length - this.offset}`);
    }
  }
}

function decodePrimitive(name: string, c: Cursor): unknown {
  c.need(0, `primitive ${name}`);
  switch (name) {
    case 'bool': {
      c.need(1, 'bool');
      const v = c.buf.readUInt8(c.offset) !== 0;
      c.offset += 1;
      return v;
    }
    case 'u8': {
      c.need(1, 'u8');
      const v = c.buf.readUInt8(c.offset);
      c.offset += 1;
      return v;
    }
    case 'i8': {
      c.need(1, 'i8');
      const v = c.buf.readInt8(c.offset);
      c.offset += 1;
      return v;
    }
    case 'u16': {
      c.need(2, 'u16');
      const v = c.buf.readUInt16LE(c.offset);
      c.offset += 2;
      return v;
    }
    case 'i16': {
      c.need(2, 'i16');
      const v = c.buf.readInt16LE(c.offset);
      c.offset += 2;
      return v;
    }
    case 'u32': {
      c.need(4, 'u32');
      const v = c.buf.readUInt32LE(c.offset);
      c.offset += 4;
      return v;
    }
    case 'i32': {
      c.need(4, 'i32');
      const v = c.buf.readInt32LE(c.offset);
      c.offset += 4;
      return v;
    }
    case 'f32': {
      c.need(4, 'f32');
      const v = c.buf.readFloatLE(c.offset);
      c.offset += 4;
      return v;
    }
    case 'u64': {
      c.need(8, 'u64');
      const v = c.buf.readBigUInt64LE(c.offset);
      c.offset += 8;
      return v;
    }
    case 'i64': {
      c.need(8, 'i64');
      const v = c.buf.readBigInt64LE(c.offset);
      c.offset += 8;
      return v;
    }
    case 'f64': {
      c.need(8, 'f64');
      const v = c.buf.readDoubleLE(c.offset);
      c.offset += 8;
      return v;
    }
    case 'u128':
    case 'i128': {
      c.need(16, name);
      const bytes = c.buf.subarray(c.offset, c.offset + 16);
      c.offset += 16;
      const unsigned = bytesToBigIntLE(bytes);
      if (name === 'u128') return unsigned;
      const signBit = 1n << 127n;
      return unsigned >= signBit ? unsigned - (1n << 128n) : unsigned;
    }
    case 'publicKey':
    case 'pubkey': {
      c.need(32, 'pubkey');
      const v = bs58.encode(c.buf.subarray(c.offset, c.offset + 32));
      c.offset += 32;
      return v;
    }
    case 'string': {
      c.need(4, 'string length');
      const len = c.buf.readUInt32LE(c.offset);
      c.offset += 4;
      c.need(len, 'string body');
      const v = c.buf.toString('utf8', c.offset, c.offset + len);
      c.offset += len;
      return v;
    }
    case 'bytes': {
      c.need(4, 'bytes length');
      const len = c.buf.readUInt32LE(c.offset);
      c.offset += 4;
      c.need(len, 'bytes body');
      const v = c.buf.subarray(c.offset, c.offset + len);
      c.offset += len;
      return v;
    }
    default:
      throw new IdlTypeError(`unsupported primitive type "${name}"`);
  }
}

function bytesToBigIntLE(bytes: Buffer): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) result = (result << 8n) | BigInt(bytes[i]!);
  return result;
}

function decodeFields(idl: AnchorIdl, fields: Record<string, any>[], c: Cursor): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field.name] = decodeTyped(idl, normalizeType(field.type), c);
  }
  return out;
}

function decodeTyped(idl: AnchorIdl, type: NormalizedType, c: Cursor): unknown {
  switch (type.kind) {
    case 'primitive':
      return decodePrimitive(type.name, c);
    case 'option': {
      c.need(1, 'option tag');
      const tag = c.buf.readUInt8(c.offset);
      c.offset += 1;
      if (tag === 0) return null;
      if (tag !== 1) throw new IdlTypeError(`option tag must be 0 or 1, got ${tag}`);
      return decodeTyped(idl, type.inner, c);
    }
    case 'vec': {
      c.need(4, 'vec length');
      const len = c.buf.readUInt32LE(c.offset);
      c.offset += 4;
      const items: unknown[] = [];
      for (let i = 0; i < len; i++) items.push(decodeTyped(idl, type.inner, c));
      return items;
    }
    case 'array': {
      const items: unknown[] = [];
      for (let i = 0; i < type.len; i++) items.push(decodeTyped(idl, type.inner, c));
      return items;
    }
    case 'defined': {
      const def = findTypeDef(idl, type.name);
      const kind = def.type?.kind;
      if (kind === 'struct') return decodeFields(idl, def.type.fields ?? [], c);
      if (kind === 'enum') return decodeEnum(idl, def, c);
      throw new IdlTypeError(`defined type "${type.name}" has unsupported kind "${kind}"`);
    }
  }
}

function decodeEnum(idl: AnchorIdl, def: Record<string, any>, c: Cursor): Record<string, unknown> {
  c.need(1, `enum ${def.name} tag`);
  const tag = c.buf.readUInt8(c.offset);
  c.offset += 1;
  const variants: Record<string, any>[] = def.type.variants ?? [];
  const variant = variants[tag];
  if (!variant) throw new IdlTypeError(`enum "${def.name}": no variant at tag ${tag} (have ${variants.length})`);
  const fields: unknown[] | undefined = variant.fields;
  if (!fields || fields.length === 0) return { variant: variant.name };
  if (isNamedFields(fields)) {
    return { variant: variant.name, fields: decodeFields(idl, fields as Record<string, any>[], c) };
  }
  const positional = (fields as { type: unknown }[]).map((f) => decodeTyped(idl, normalizeType(f.type), c));
  return { variant: variant.name, fields: positional };
}

// ── Instruction decode entry point ──────────────────────────────────────────

export function decodeAnchorInstruction(programId: string, idl: AnchorIdl, data: Buffer): AnchorDecodeResult {
  const dataHex = data.toString('hex');
  if (data.length < 8) {
    return { kind: 'undecoded', reason: 'instruction data shorter than an 8-byte discriminator', programId, dataHex };
  }
  const discriminator = data.subarray(0, 8);
  const ixDef = findInstructionByDiscriminator(idl, discriminator);
  if (!ixDef) {
    return {
      kind: 'undecoded',
      reason: `no instruction in IDL "${idlName(idl) ?? 'unknown'}" matches discriminator ${discriminator.toString('hex')}`,
      programId,
      dataHex,
    };
  }
  try {
    const c = new Cursor(data.subarray(8));
    const args = decodeFields(idl, ixDef.args ?? [], c);
    return {
      kind: 'decoded',
      ix: { programId, name: ixDef.name, args, discriminatorHex: discriminator.toString('hex') },
    };
  } catch (e) {
    return {
      kind: 'undecoded',
      reason: `matched instruction "${ixDef.name}" but failed to decode args: ${(e as Error).message}`,
      programId,
      dataHex,
    };
  }
}
