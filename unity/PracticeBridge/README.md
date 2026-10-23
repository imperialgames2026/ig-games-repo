# Practice table integration candidate

Route: `/TableLab` (existing authentication and app layout). This is a new route, leaving current production game routes and Android signing configuration intact.

The current playable visual spike uses Three.js meshes inside the React WebView. It demonstrates 3D rendering in the existing Vite/Capacitor bundle, without a new native application. It is not a compiled Unity game. Geometry and materials are procedural placeholders pending realistic table assets.

`outcomes.mjs` owns local practice generation and immutable outcome messages. `TableScene` consumes those messages and cannot settle balances. React owns local demo chips, which have no persisted value or wallet API. Pass-line stakes remain reserved through the point. No hosted database changes.

For Unity Web: host a versioned, same-origin Unity build under `/unity/practice/<version>/`. Load its generated loader only after the player opens the game, create the Unity instance in a dedicated canvas, and pass validated outcomes through `presentToUnity(instance, outcome)`. Attach `PracticeBridge.cs` to a GameObject named PracticeBridge; wire its presentation event to the scene animator. The receiver validates practice scope and ignores duplicate rounds. Do not accept Unity messages as wallet or settlement instructions. Call Unity Quit on route exit; handle load failures with retry and a return-to-lobby action. Keep React touch controls outside the canvas.

Not yet verified: Unity compilation/export, actual Unity load/quit and Android lifecycle, compressed asset hosting headers, context loss recovery, physical Razr frame pacing/memory/thermal behavior. Do not replace the current screens or describe the Unity bridge as proven until these pass. The existing keystore, app ID and signing files have not been accessed or changed.
