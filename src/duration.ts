import type { DurationInput, InstantInput } from "./types.js";

const DURATION_TOKEN_PATTERN = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/gy;

export function parseDuration(input: DurationInput, fieldName = "duration"): number {
  if (typeof input === "number") {
    assertFiniteNonNegative(input, fieldName);
    return input;
  }

  if (typeof input === "string") {
    let total = 0;
    let matched = false;
    let consumed = 0;
    DURATION_TOKEN_PATTERN.lastIndex = 0;

    for (;;) {
      const match = DURATION_TOKEN_PATTERN.exec(input);
      if (match === null) {
        break;
      }
      matched = true;
      consumed = DURATION_TOKEN_PATTERN.lastIndex;
      const amount = Number(match[1]);
      assertFiniteNonNegative(amount, fieldName);
      total += amount * unitToMilliseconds(match[2]);
    }

    if (!matched || consumed !== input.length) {
      throw new TypeError(`${fieldName} must be a duration like "10h", "15m", or "3m45s"`);
    }
    return total;
  }

  const total =
    (input.milliseconds ?? 0) +
    (input.seconds ?? 0) * 1_000 +
    (input.minutes ?? 0) * 60_000 +
    (input.hours ?? 0) * 3_600_000 +
    (input.days ?? 0) * 86_400_000;
  assertFiniteNonNegative(total, fieldName);
  return total;
}

export function toDate(input: InstantInput, fieldName: string): Date {
  const date =
    input instanceof Date ? new Date(input.getTime()) : typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date, epoch milliseconds, or date string`);
  }
  return date;
}

export function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

export function epochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1_000);
}

export function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set([...values])];
}

function unitToMilliseconds(unit: string | undefined): number {
  switch (unit) {
    case "ms":
      return 1;
    case "s":
      return 1_000;
    case "m":
      return 60_000;
    case "h":
      return 3_600_000;
    case "d":
      return 86_400_000;
    default:
      throw new TypeError(`Unsupported duration unit: ${unit}`);
  }
}

function assertFiniteNonNegative(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a finite non-negative number`);
  }
}
