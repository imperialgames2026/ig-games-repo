export async function createWasmUrl(manifest, base, fetcher = fetch) {
 if (!Array.isArray(manifest.wasmParts) || manifest.wasmParts.length !== 2 || !manifest.wasmParts.every((name, i) => name === `unity.wasm.part${i}`)) throw Error('Invalid Unity runtime inventory');
 const parts = await Promise.all(manifest.wasmParts.map(async name => { const response = await fetcher(new URL(name, base)); if (!response.ok) throw Error('Unity runtime unavailable'); return response.arrayBuffer(); }));
 const blob = new Blob(parts, { type: 'application/wasm' });
 const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
 if (hash !== manifest.wasmSHA256) throw Error('Unity runtime integrity mismatch');
 return URL.createObjectURL(blob);
}
