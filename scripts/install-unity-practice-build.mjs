import { mkdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/install-unity-practice-build.mjs /path/to/Build/WebGL",
  );
const target = resolve("public/unity/practice/v3");
await mkdir(join(target, "Build"), { recursive: true });
const manifest = { version: 1, mode: "practice", sha256: {} };
for (const [key, suffix] of [
  ["loaderUrl", "loader.js"],
  ["frameworkUrl", "framework.js"],
  ["dataUrl", "data"],
  ["codeUrl", "wasm"],
]) {
  const name = "WebGL." + suffix,
    from = join(resolve(source), "Build", name),
    size = (await stat(from)).size;
  if (size === 0 || size > 24 * 1024 * 1024)
    throw new Error("Unity asset outside size budget: " + name);
  const bytes = await readFile(from);
  if (suffix === "wasm" && bytes.subarray(0, 4).toString("hex") !== "0061736d")
    throw new Error("Not a WebAssembly binary");
  await copyFile(from, join(target, "Build", name));
  manifest[key] = "/unity/practice/v3/Build/" + name;
  manifest.sha256[name] = createHash("sha256").update(bytes).digest("hex");
}
await writeFile(
  join(target, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Installed versioned practice Unity build.");
