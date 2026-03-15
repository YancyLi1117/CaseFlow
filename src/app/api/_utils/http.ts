import { NextResponse } from "next/server";

export type ApiError = { error: string; detail?: string };

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, error: string, detail?: string) {
  const body: ApiError = detail ? { error, detail } : { error };
  return NextResponse.json(body, { status });
}

export function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${name} must be a non-empty string`);
  return v;
}

export function mustNumber(v: unknown, name: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`${name} must be a number`);
  return v;
}

export function mustStringOrNull(v: unknown, name: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Error(`${name} must be string|null`);
  const t = v.trim();
  return t === "" ? null : t;
}

export function mustStringArray(v: unknown, name: string): string[] {
  if (!Array.isArray(v)) throw new Error(`${name} must be string[]`);
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || x.trim() === "") throw new Error(`${name} must be string[] (non-empty items)`);
    out.push(x);
  }
  return out;
}

export type XorInstructionOrPrompt =
  | { instructionId: string; prompt: null }
  | { instructionId: null; prompt: string };

export function parseXorInstructionOrPrompt(input: {
  instructionId?: unknown;
  prompt?: unknown;
}): XorInstructionOrPrompt {
  const instructionId = mustStringOrNull(input.instructionId, "instructionId");
  const prompt = mustStringOrNull(input.prompt, "prompt");

  const hasInst = !!instructionId;
  const hasPrompt = !!prompt;

  if (hasInst === hasPrompt) {
    // both true or both false
    throw new Error("Exactly one of instructionId or prompt must be provided.");
  }

  return hasInst
    ? { instructionId: instructionId as string, prompt: null }
    : { instructionId: null, prompt: prompt as string };
}