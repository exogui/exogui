# Online Updates

exogui supports online updates for select platforms using [electron-updater](https://www.electron.build/auto-update).

## How It Works

### Update Channels

exogui has two update channels:

- **stable** — tested releases, recommended for most users
- **beta** — pre-releases with newer features, may be unstable

The channel is selected in the Config page under **Updates → Update Channel**. Beta users receive both beta and stable updates; stable users receive only stable updates.

### Update Detection

1. **Current version**: Read from `package.json` at build time, embedded in the application
2. **Remote version**: Fetched from the channel manifest (`latest-linux.yml` for stable, `beta-linux.yml` for beta) published to GitHub Releases
3. **Comparison**: Uses semantic versioning to determine if an update is available

### Update Flow

```
App Startup (if enabled)
    ↓
Check GitHub Releases for channel manifest (latest-*.yml or beta-*.yml)
    ↓
Compare versions: remote > current ?
    ↓
If YES: Show update dialog with release notes
    ↓
User clicks "Download" → Download update
    ↓
Download complete → Prompt to restart
    ↓
On restart: Install update automatically
```

### Configuration

Online updates are configured in **Config page → Updates** or directly in `config.json`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `enableOnlineUpdate` | `boolean` | `true` | Enable or disable update checks |
| `updateChannel` | `"stable"` \| `"beta"` | `"stable"` | Which channel to follow |

## Platform Support Matrix

| OS      | Format      | Support | Notes                                    |
|---------|-------------|---------|------------------------------------------|
| Linux   | AppImage    | ✅ YES  | Fully supported, enabled by default      |
| Linux   | tar.gz      | ❌ NO   | No technical support in electron-updater |
| Linux   | Snap        | ⊘ N/A   | Snap Store handles updates               |
| Linux   | Flatpak     | ⊘ N/A   | Flathub handles updates                  |
| Linux   | deb/rpm     | ⊘ N/A   | System package manager handles updates   |
| Windows | NSIS (.exe) | 🔒 DIS  | Requires code signing certificate        |
| Windows | ZIP         | ❌ NO   | No technical support in electron-updater |
| macOS   | DMG         | 🔒 DIS  | Requires code signing + notarization     |

### Legend

- **✅ YES**: Supported and enabled
- **❌ NO**: Not technically possible (electron-updater limitation)
- **⊘ N/A**: Not applicable (external update mechanism)
- **🔒 DIS**: Technically supported but disabled (requires paid certificates)

## Release Process

Releases are fully automated via GitHub Actions workflows:

- **Stable release**: triggered by merging a PR into `master`. Strips the `-beta` suffix from the version, builds all platforms, and publishes a stable GitHub Release.
- **Beta release**: triggered by merging a PR into `develop`. Bumps the patch version and appends `-beta`, builds all platforms, and publishes a pre-release GitHub Release.

Both workflows generate channel manifest files (`latest-*.yml` and `beta-*.yml`) that electron-updater uses to detect updates.

Releases are skipped automatically if the PR only touches documentation or workflow files, or if the `skip-release` label is applied to the PR.

### Versioning

| Branch | Version format | Example |
|---|---|---|
| `develop` | `X.Y.Z-beta` | `1.2.28-beta` |
| `master` | `X.Y.Z` | `1.2.28` |

When a stable release is cut, the `-beta` suffix is stripped. The next beta on develop increments the patch number.

## Technical Details

### Update Requirements

For online updates to work:

1. ✅ App must be **packaged** (not a development build)
2. ✅ Platform must be **supported** (see matrix above)
3. ✅ `enableOnlineUpdate` set to `true` in config
4. ✅ GitHub release must be **published** (not draft)
5. ✅ Release must contain the channel manifest (`latest-linux.yml` or `beta-linux.yml`)
6. ✅ Internet connection available

### Channel Manifest Format

```yaml
# beta-linux.yml (or latest-linux.yml for stable)
version: 1.2.28-beta
files:
  - url: exogui.AppImage
    sha512: <hash>
    size: 123456789
    blockMapSize: 131943
path: exogui.AppImage
sha512: <hash>
releaseDate: '2026-01-01T00:00:00.000Z'
```

### Linux AppImage Updates

- Downloads the new AppImage to a temporary location
- Verifies SHA512 checksum
- On restart: replaces the old AppImage with the new one
- Old AppImage is deleted

**Important:** The AppImage must be in a **writable location** (not a read-only mounted filesystem).

## Troubleshooting

### Updates Not Detected

**Check:**
1. Is `enableOnlineUpdate` set to `true` in config.json?
2. Is the app running as a packaged AppImage? (check `process.env.APPIMAGE`)
3. Is there a newer version published on GitHub?
4. Does the GitHub release contain the correct channel manifest file?
5. Is the release marked as published (not draft)?

**View logs:**
```bash
# Run AppImage from terminal to see update logs
./exogui.AppImage

# Look for lines starting with:
[OnlineUpdater] Checking for updates...
[OnlineUpdater] Update available: 1.2.4
[OnlineUpdater] Update downloaded: 1.2.4
```

### Disable Auto-Updates

Edit `config.json` (see [config.md](./config.md)):
```json
{
  "enableOnlineUpdate": false
}
```

## Future Plans

- [ ] Windows NSIS support (when code signing certificate available)
- [ ] macOS DMG support (when Apple Developer account + notarization available)
- [x] Update channel selection (stable/beta)
- [x] Manual "Check for Updates" button in UI
- [x] Update download progress indicator
- [x] Release notes display

## Related Documentation

- [Configuration Files](./config.md) - Description of the configuration files
- [electron-updater](https://www.electron.build/auto-update) - Official documentation
- [GitHub Releases](https://github.com/exogui/exogui/releases) - Published releases
