// Browser-observed consistency evidence, NOT server trust or production fairness.
// No nonce, fleet payload, card identity or account token is retained here.
const prefix = 'imperial-fleet-observations-v1:';
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const epoch = room => room.state.deploymentId ?? 'legacy';
const fleetRoom = room => room && ['battleship','battleship6'].includes(room.game) &&
  typeof room.id === 'string' && Number.isInteger(room.version);
export function createFleetVerifier(storage = null) {
  const memory = new Map();
  function load(id) {
    if (memory.has(id)) return memory.get(id);
    let record = null;
    try {
      const raw = storage?.getItem(prefix + id);
      if (raw) {
        record = JSON.parse(raw);
        if (record.schema !== 1 || typeof record.epoch !== 'string' || !Number.isInteger(record.version) ||
          !Array.isArray(record.pins) || record.pins.length !== 2 || record.pins.some(p => p !== null &&
            (!hash(p.hash) || typeof p.witnessed !== 'boolean')) || typeof record.failed !== 'boolean') throw Error('Invalid saved observations');
      }
    } catch { record = {error:'Saved fleet observations are unavailable or invalid. Prior deployment cannot be verified.'}; }
    memory.set(id, record);
    return record;
  }
  function save(id, record) {
    memory.set(id, record);
    try { storage?.setItem(prefix + id, JSON.stringify(record)); }
    catch { record.persistenceWarning = true; }
  }
  function observe(room) {
    if (!fleetRoom(room) || room.replay) return;
    const s = room.state, currentEpoch = epoch(room);
    let record = load(room.id);
    if (record?.error || typeof currentEpoch !== 'string') return;
    const beforeShots = !s.over && ['placement','play'].includes(s.phase) &&
      Array.isArray(s.shotHistory) && s.shotHistory.length === 0 &&
      Array.isArray(s.shots) && s.shots.length === 2 && s.shots.every(a => Array.isArray(a) && a.length === 100 && a.every(v => v === null));
    if (record && room.version < record.version) return;
    if (record && record.epoch !== currentEpoch) {
      // Only an observed fresh reset/placement can start a new generation.
      // A new epoch supplied in a final/play response cannot bypass the pins.
      if (!(room.version > record.version && beforeShots && s.phase === 'placement' &&
        s.ready?.every(v => v === false) && !s.fleetProofs?.some(Boolean))) {
        record.failed = true; save(room.id,record); return;
      }
      record = null;
    }
    record ??= {schema:1,epoch:currentEpoch,version:room.version,pins:[null,null],failed:false};
    const proofs = s.fleetProofs;
    if (proofs !== undefined && (!Array.isArray(proofs) || proofs.length !== 2)) record.failed = true;
    for (let player=0;player<2;player++) {
      const proof = Array.isArray(proofs) ? proofs[player] : null, pin = record.pins[player];
      if (pin) {
        if (!proof || proof.version !== 1 || proof.commitment !== pin.hash) record.failed = true;
      } else if (proof) {
        if (proof.version !== 1 || !hash(proof.commitment)) record.failed = true;
        else record.pins[player] = {hash:proof.commitment,witnessed:beforeShots && s.ready?.[player] === true};
      }
    }
    record.version = room.version;
    save(room.id,record);
  }
  async function verify(room) {
    if (!fleetRoom(room)) throw Error('Invalid fleet room.');
    const record = load(room.id), s = room.state;
    if (record?.error) throw Error(record.error);
    if (record?.failed || (record && record.epoch !== epoch(room))) throw Error('Fleet verification failed: deployment commitment changed.');
    if (!record || record.pins.some(p => !p?.witnessed)) throw Error('Not verified: deployment was not witnessed before play in this browser. Final-response hashes alone are not deployment evidence.');
    if (!s.over || !Array.isArray(s.fleetProofs) || s.fleetProofs.length !== 2) throw Error('Final fleet reveal is unavailable.');
    for (let p=0;p<2;p++) {
      const proof = s.fleetProofs[p];
      if (!proof || proof.version !== 1 || proof.commitment !== record.pins[p].hash ||
        typeof proof.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(proof.nonce) || typeof proof.payload !== 'string') throw Error('Fleet verification failed: invalid or changed proof.');
      const bytes = new TextEncoder().encode(proof.nonce+':'+proof.payload);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      const payload = JSON.parse(proof.payload);
      if (digest !== record.pins[p].hash || payload.version !== 1 || payload.player !== p ||
        (payload.deploymentId ?? 'legacy') !== record.epoch || payload.fleetSize !== (s.fleetSize ?? 5) ||
        JSON.stringify(payload.ships) !== JSON.stringify(s.ships[p])) throw Error('Fleet verification failed: final fleet does not match the original observation.');
    }
    return 'Both final fleets match commitments observed before play in this browser. Placement consistency only; deterministic practice RNG is not production fairness.' +
      (record.persistenceWarning || !storage ? ' Observation storage is unavailable; evidence is limited to this page lifetime.' : '');
  }
  return {observe,verify};
}
let storage = null;
try { if (typeof window !== 'undefined') storage = window.localStorage; } catch {}
export const fleetVerifier = createFleetVerifier(storage);
