# Path placeholders — v1

Placeholders make profiles portable across machines, users and operating systems. Paths keep the placeholders, and the Desktop resolves them at run time. The machine-readable list is [`placeholders.json`](placeholders.json). Both files **MUST** change together.

## Root placeholders

A root placeholder **MUST** be the whole first segment of a path.

| Placeholder | Scope | OS | Windows | Linux | macOS |
|---|---|---|---|---|---|
| `<home>` | user | any | `%USERPROFILE%` | `$HOME` | `$HOME` |
| `<base>` | game | any | Detected installation directory | same | same |
| `<winAppData>` | user | windows | `%APPDATA%` | prefix¹ | — |
| `<winLocalAppData>` | user | windows | `%LOCALAPPDATA%` | prefix¹ | — |
| `<winLocalAppDataLow>` | user | windows | `%USERPROFILE%\AppData\LocalLow` | prefix¹ | — |
| `<winDocuments>` | user | windows | Documents known folder | prefix¹ | — |
| `<winSavedGames>` | user | windows | Saved Games known folder | prefix¹ | — |
| `<winPublic>` | user | windows | `%PUBLIC%` | prefix¹ | — |
| `<winProgramData>` | user | windows | `%PROGRAMDATA%` | prefix¹ | — |
| `<xdgData>` | user | linux | — | `$XDG_DATA_HOME` (default `~/.local/share`) | — |
| `<xdgConfig>` | user | linux | — | `$XDG_CONFIG_HOME` (default `~/.config`) | — |
| `<macAppSupport>` | user | macos | — | — | `~/Library/Application Support` |
| `<macPreferences>` | user | macos | — | — | `~/Library/Preferences` |
| `<macContainers>` | user | macos | — | — | `~/Library/Containers` |

¹ On Linux, Windows placeholders resolve **inside** the Wine/Proton prefix detected for the game. For example, `<winAppData>` resolves to `<prefix>/drive_c/users/<user>/AppData/Roaming`, where `<user>` is `steamuser` for Proton. They never resolve outside a prefix.

Windows known folders **MUST** be resolved through the OS API (`SHGetKnownFolderPath`), never through hard-coded paths, because users can relocate them.

## Segment placeholders

These placeholders **MAY** appear inside any segment after the first, for example `<storeUserId>` or `save_<storeUserId>.dat`.

| Placeholder | Value |
|---|---|
| `<storeUserId>` | User ID in the store that installed the game. For Steam, **both** forms of every account found in `userdata/` are tried: the 32-bit account ID (as in `userdata/<id>`) and the 64-bit SteamID (account ID + 76561197960265728), since games use either. The path expands once per value; only values that exist on disk produce matches. |
| `<storeGameId>` | ID of the game in the store that installed it, for example the Steam app ID. |
| `<osUserName>` | Login name of the current OS user. |

If a placeholder cannot be resolved on the current machine (for example `<base>` for a game that is not installed), the path is skipped. It is not an error.

## Relationship to Ludusavi

The names match the Ludusavi manifest wherever an equivalent exists, so conversion is mostly one-to-one. Some Ludusavi placeholders are not supported:

- `<root>` and `<game>` are expressed through `<base>`;
- `<winDir>` is not supported, because SaveForge never touches the Windows directory. The converter **MUST** drop such paths.
