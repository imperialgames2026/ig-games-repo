// Independent browser/Node verification for the deployed practice Dice protocol.
// Never use this result to credit a wallet or to authorize financial settlement.
const encoder = new TextEncoder();
const SAMPLE_LIMIT = 4294967292;
const asHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
  if (typeof text !== 'string') throw new TypeError('Expected a string');
  return asHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

export async function calculatePracticeDice(serverSeed, clientSeed, nonce) {
  if (typeof serverSeed !== 'string' || serverSeed.length < 1 ||
      typeof clientSeed !== 'string' || clientSeed.length < 1 ||
      !Number.isSafeInteger(nonce) || nonce < 0) {
    throw new TypeError('Invalid fairness inputs');
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const dice = [];
  for (let counter = 0; dice.length < 2 && counter < 32; counter += 1) {
    const signature = await crypto.subtle.sign('HMAC', key,
      encoder.encode(clientSeed + ':' + nonce + ':' + counter));
    const values = new DataView(signature);
    for (let offset = 0; offset <= 28 && dice.length < 2; offset += 4) {
      const sample = values.getUint32(offset, false);
      if (sample < SAMPLE_LIMIT) dice.push((sample % 6) + 1);
    }
  }
  if (dice.length !== 2) throw new Error('Unable to calculate dice');
  return { dice, sum: dice[0] + dice[1] };
}

export async function verifyPracticeDice(commit, reveal) {
  if (!commit || !reveal || commit.phase !== 'committed' ||
      reveal.phase !== 'revealed' || commit.game !== 'dice' ||
      reveal.game !== 'dice' || commit.id !== reveal.roundId ||
      commit.algorithm !== 'hmac-sha256-v2' || reveal.algorithm !== 'hmac-sha256-v2' ||
      typeof reveal.serverSeed !== 'string' ||
      commit.server_seed_hash !== reveal.serverSeedHash ||
      typeof reveal.clientSeed !== 'string' ||
      !Number.isSafeInteger(reveal.nonce) || reveal.nonce !== commit.nonce) return false;
  const commitmentHash = await sha256Hex(reveal.serverSeed);
  if (commitmentHash !== commit.server_seed_hash) return false;
  const expected = await calculatePracticeDice(reveal.serverSeed, reveal.clientSeed, reveal.nonce);
  return Array.isArray(reveal.outcome?.dice) &&
    reveal.outcome.dice.length === 2 &&
    expected.dice.every((n, i) => n === reveal.outcome.dice[i]) &&
    expected.sum === reveal.outcome.sum;
}
