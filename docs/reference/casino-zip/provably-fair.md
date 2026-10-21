# Provably fair demo protocol (v1)

This protocol is for **non-monetary** demo games only. It is not a certified gambling RNG, payment engine, or settlement mechanism.

1. Authenticated client chooses a client seed and sends `{action:"commit", game, clientSeed}` to `provably-fair-demo`.
2. The server creates 32 cryptographically random bytes, hex-encodes them as the server seed, and stores the SHA-256 hash with the pending round. The response contains the round ID, hash, game, client seed, and nonce, **not the secret seed**.
3. Client sends `{action:"reveal", roundId}`. Server computes HMAC-SHA-256 keyed by the server-seed UTF-8 bytes, with message `clientSeed:nonce:counter` (counter starts at 0). Each digest is read as eight unsigned big-endian 32-bit integers. Values >= 4294967292 are rejected; accepted values map to `(n % 6) + 1`. Two values are drawn for dice; one for coin or number. Coin maps odd to heads, even to tails.
4. Server persists and reveals the outcome and seed. The frontend independently recomputes the seed hash and full game outcome; mismatches are rejected. Repeating reveal returns the already settled result.

**Trust limitations:** The server receives the client seed before choosing its secret seed, so a malicious server could select a favorable seed. For adversarially robust fairness, first publish a server-seed commitment, then accept a player-chosen client seed, then settle and reveal the seed; ideally precommit a sequence with a nonce and immutable audit trail. This demo does not yet implement that stronger ordering. It also does not rate-limit or enforce a cap on pending rounds. Do not use for wagers or financial balances.

The backend uses service-role credentials only inside the Supabase Edge Function. Client table privileges intentionally exclude `server_seed`; only authenticated callers can request their own round reveal.
