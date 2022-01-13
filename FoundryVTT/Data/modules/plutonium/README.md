### Installation

- Copy the directory containing this README to `%appdata%/../Local/FoundryVTT/Data/modules`
- Restart Foundry
- In Foundry, go to the "Settings" ("?") tab, click "Manage Modules," and enable "Plutonium." Be sure to save the changes by clicking "Update Modules."

### Rivet

A companion browser extension, "Rivet," is available on the [Chrome](https://chrome.google.com/webstore/detail/rivet/igmilfmbmkmpkjjgoabaagaoohhhbjde) and [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/rivet/) web stores. With Rivet, you can one-click import content (notably creatures as a GM, or spells as a player) when browsing 5etools.

### Server-Side Modding

_**Note: Local/dedicated installs only!** You cannot use this with hosting services, such as Forge. Turn back now._

Plutonium comes with a server-side mod to enable mass-downloading via the built-in Art Browser. To install this:

- Find Foundry's `main.mjs` file in:
   - If you installed "for current user only" on Windows: `%appdata%/../Local/Programs/FoundryVTT/resources/app`
   - If you installed "for all users" on Windows: `Program Files/FoundryVTT/resources/app`
- Edit the file, changing this:
```js
init.default({
	args: process.argv,
	root: root,
	messages: startupMessages,
	debug: isDebug
});
```

to

```js
await init.default({
	args: process.argv,
	root: root,
	messages: startupMessages,
	debug: isDebug
});
(await import("./plutonium-backend.mjs")).Plutonium.init();
```
- Copy the `plutonium-backend.mjs` file from `server/0.8.x/` to the folder containing `main.mjs`
- Launch Foundry, and pray that nothing explodes. If everything is working, the in-game Foundry logo (in the top-left of the screen) will show the running Plutonium backend version.
