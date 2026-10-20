export type FairGame = "dice" | "coin" | "number";
export type FairOutcome = { dice: number[]; sum: number } | { coin: "heads" | "tails" } | { number: number };
const encoder = new TextEncoder();
const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

export async function verifyFairRound(input: {
  game: FairGame;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  serverSeedHash: string;
  outcome: FairOutcome;
}): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(input.serverSeedHash) || !Number.isSafeInteger(input.nonce) || input.nonce < 0) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input.serverSeed)));
  if (toHex(digest) !== input.serverSeedHash) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(input.serverSeed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const numbers: number[] = [];
  const count = input.game === "dice" ? 2 : 1;
  let counter = 0;
  while (numbers.length < count) {
    const bytes = new DataView(await crypto.subtle.sign("HMAC", key, encoder.encode(`${input.clientSeed}:${input.nonce}:${counter++}`)));
    for (let i = 0; i <= 28 && numbers.length < count; i += 4) {
      const n = bytes.getUint32(i, false);
      if (n < 4294967292) numbers.push(n % 6 + 1);
    }
  }
  // JSONB normalizes object-key ordering. Compare typed outcome values rather
  // than serialized JSON: an idempotent replay must verify exactly as the first reveal.
  const received: unknown = input.outcome;
  if (!received || typeof received !== "object" || Array.isArray(received)) return false;
  const keys = Object.keys(received);
  if (input.game === "dice") {
    if (keys.length !== 2 || !keys.includes("dice") || !keys.includes("sum")) return false;
    const value = received as { dice?: unknown; sum?: unknown };
    return Array.isArray(value.dice) && value.dice.length === 2
      && value.dice[0] === numbers[0] && value.dice[1] === numbers[1]
      && value.sum === numbers[0] + numbers[1];
  }
  if (input.game === "coin") {
    return keys.length === 1 && keys[0] === "coin"
      && (received as { coin?: unknown }).coin === (numbers[0] % 2 ? "heads" : "tails");
  }
  return input.game === "number" && keys.length === 1 && keys[0] === "number"
    && (received as { number?: unknown }).number === numbers[0];
}
