// Only versioned assets on this site can execute as the practice renderer.
export function validateUnityManifest(manifest, origin) {
  if (manifest?.version !== 1 || manifest.mode !== "practice")
    throw new Error("Unsupported practice build");
  const result = {};
  for (const key of ["loaderUrl", "dataUrl", "frameworkUrl", "codeUrl"]) {
    if (typeof manifest[key] !== "string")
      throw new Error("Missing Unity asset");
    const url = new URL(manifest[key], origin);
    if (
      url.origin !== origin ||
      !url.pathname.startsWith("/unity/practice/v1/") ||
      url.search ||
      url.hash
    )
      throw new Error("Untrusted Unity asset");
    result[key] = url.href;
  }
  return {
    ...result,
    companyName: "Imperial Gaming LLC",
    productName: "Imperial Practice Tables",
    productVersion: "1",
    devicePixelRatio: Math.min(globalThis.devicePixelRatio || 1, 1.5),
  };
}
let active = false;
export async function loadUnity(
  canvas,
  { onProgress = () => {}, signal } = {},
) {
  if (active) throw new Error("A Unity table is already open");
  active = true;
  let script,
    instance,
    cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await fetch("/unity/practice/v1/manifest.json", {
      signal,
      cache: "no-cache",
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      throw new Error("Unity practice build is not installed on this host yet");
    const config = validateUnityManifest(
      await response.json(),
      location.origin,
    );
    if (cancelled || signal?.aborted) throw new Error("Load cancelled");
    const factory = await new Promise((resolve, reject) => {
      script = document.createElement("script");
      script.src = config.loaderUrl;
      script.onload = () =>
        typeof window.createUnityInstance === "function"
          ? resolve(window.createUnityInstance)
          : reject(new Error("Unity loader unavailable"));
      script.onerror = () =>
        reject(new Error("Unable to download Unity loader"));
      document.head.appendChild(script);
    });
    if (cancelled) throw new Error("Load cancelled");
    // Unity construction is not abortable. Quit a late instance after route exit.
    instance = await factory(canvas, config, onProgress);
    if (cancelled) {
      await instance.Quit();
      throw new Error("Load cancelled");
    }
    let closed = false;
    return {
      SendMessage: (...args) => {
        if (!closed) instance.SendMessage(...args);
      },
      Quit: async () => {
        if (closed) return;
        closed = true;
        try {
          await instance.Quit();
        } finally {
          script?.remove();
          active = false;
          signal?.removeEventListener("abort", cancel);
        }
      },
    };
  } catch (error) {
    script?.remove();
    active = false;
    signal?.removeEventListener("abort", cancel);
    throw error;
  }
}
