# Imperial 3D practice prototype

This candidate adds `/TableLab` to the existing authenticated React/Capacitor app and `/practice-lab.html` as a standalone practice-only review entry. Existing production game routes, app ID, signing configuration and keystore are unchanged.

## Implemented

- Actual Unity 6000.3.6f1 Web build: roulette and craps scene, original cloth textures, 37 single-zero pockets, wheel, ball, rounded dice with opposite faces summing to seven, rails and chip stacks.
- React loader with progress, retry, failure handling, same-origin versioned asset validation and an isolated frame per Unity session. Frame messages check origin and source; page exit requests Unity Quit and discards the runtime context. Lightweight Three.js renderer is available as a fallback.
- Full-size interactive felt with a wager input, amount-labelled chips on tapped fields, unlimited repeated placements within the available practice balance, Clear and Back / Undo. Camera modes, zoom, reduced motion, optional synthesized sounds and recent results.
- Immutable practice outcomes generated outside either renderer. Unity cannot read or change balances. Animation completion gates the next round; it never supplies the outcome or payout. A guarded timeout prevents a renderer failure from trapping the practice session.
- Roulette straight numbers including green 0, plus red/black/even/odd. Bets remain after each round and reserve the next stake; optional automatic rounds repeat until stopped or underfunded. Craps pass line stays reserved through a point. Clear during action queues removal until the hand ends; Undo is locked during a pass-line contract. Pass-line win conditions and 1:1 payout are printed on both sides of the felt. Other cloth markings are decorative.
- Unity keeps rendering while React controls have focus; explicit document visibility handling pauses hidden pages.
- A 30 FPS target and capped rendering resolution, visibility handling and WebGL resource cleanup. These are budgets, not proof of physical device performance.

## Rebuild Unity

Use an isolated Unity project with Editor 6000.3.6f1 and WebGL support. Copy the C# files to Assets, Editor to Assets/Editor, Plugins to Assets/Plugins, and the two PNGs to Assets/Art. Do not use the production Android project or modify its signing files.

```
Unity -batchmode -nographics -quit -projectPath /path/to/isolated-project -buildTarget WebGL -executeMethod PracticeBuild.Build -logFile /path/to/build.log
node scripts/install-unity-practice-build.mjs /path/to/isolated-project/Build/WebGL
npm run build
```

Cloth artwork is reproducible with `python scripts/generate-practice-cloths.py` (Pillow and DejaVu fonts). The WebAssembly export uses Unity DiskSizeLTO optimization. The Unity editor build script preserves the required fonts, shader and primitive meshes explicitly for IL2CPP stripping.

## Host and test

Serve the Vite dist directory over HTTPS. Keep the generated runtime assets under `/unity/practice/v2/`; wasm must be served as `application/wasm`. This build deliberately uses uncompressed asset filenames to avoid requiring custom Content-Encoding rules. The host may supply ordinary HTTP transport compression. Rebuild with a new version path before releasing changed immutable assets.

```
node --test tests/tableLab.test.mjs
LAB_URL=http://127.0.0.1:4189/practice-lab.html LAB_CHROME=/usr/bin/google-chrome node tests/tableLab.browser.mjs
```

On a USB-authorized Android phone, `adb reverse tcp:4189 tcp:4189` permits a localhost browser preview. This does not replace or resign the installed application.

## Limits

This is a procedural 3D practice integration prototype, not a finished casino asset pack or a multiplayer game. It does not connect to Supabase, cash balances, deposits, withdrawals or wallet settlement. Physical Razr performance, Capacitor lifecycle on the device, hosting response headers and production deployment remain separate checks. After incorporating main 39eebb4, the existing mobile release guard passed and the isolated debug APK assembled with the original app ID. Embedded Unity asset hashes were verified. No phone installation or production signing change was performed. Poker, Omaha, blackjack, baccarat, Crash, Trenball and other originals have not yet been converted by this prototype.
