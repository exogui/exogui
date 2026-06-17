# Code Smells and Technical Debt

This file tracks known code smells, architectural issues, and technical debt in the codebase. These are not bugs, but areas that could be improved for better maintainability, performance, or user experience.

## Online Update System Issues

### Monolithic CSS File
**Priority:** Low
**Severity:** Low
**Effort:** High

**Issue:**
All CSS lives in `core.css` (2756 lines). Update system added 477 lines for UpdateDialog and DeveloperPage.

**Trade-offs:**
- ✅ Simple: One file, no CSS module complexity
- ✅ Consistent: All styles use same theme variables
- ❌ Hard to navigate: 2756 lines in one file
- ❌ No encapsulation: Global scope, potential conflicts

**Potential Solutions:**
1. **CSS Modules:** Scope styles to components
2. **Split files:** `core.css`, `update-dialog.css`, `developer-page.css`, etc.
3. **CSS-in-JS:** Styled-components or similar
4. **Keep as-is:** If it works, don't fix it

**Recommendation:** Keep as-is. Refactoring CSS doesn't provide enough value unless we're already experiencing naming conflicts.

---

## ConfigPage restart-required snapshot lost on renderer reload
**Priority:** Low
**Severity:** Low
**Effort:** Medium

**Issue:**
`ConfigPage.appStartConfigSnapshot` (in `src/renderer/components/pages/ConfigPage.tsx`) is a module-level variable, captured the first time ConfigPage mounts. It survives navigation away and back, but a renderer reload (DevTools Cmd+R, or any future auto-reload) resets it. After reload, the snapshot is re-captured from the freshly-loaded config, which already reflects saved-but-not-applied values — so the "Restart required" indicator silently disappears even though the running main/back processes still hold the old values.

**Trade-offs:**
- ✅ Cheap: zero plumbing, no new IPC/socket fields
- ❌ Indicator can lie after a renderer reload
- ❌ Only experts hit it (DevTools reload), but the failure is silent

**Potential Solutions:**
1. Backend caches its config at boot (`state.bootConfig`) and ships it via `GET_RENDERER_INIT_DATA`; ConfigPage compares against that.
2. Main process exposes its boot snapshot via preload.

**Recommendation:** Keep as-is. Renderer reload is an expert-only action and the price is acceptable. Revisit if auto-reload-on-error is ever added.

---

## Grid thumbnails decode full-resolution source images (perf / OOM) — RESOLVED
**Priority:** Resolved (was High)
**Severity:** High (was: could OOM-crash the renderer to a white screen)
**Effort:** Medium

**Status:** Fixed via a persistent thumbnail cache in the file server. Kept here for context and the residual follow-ups below.

**Original issue:**
`GameGridItem` (`src/renderer/components/GameGridItem.tsx`) set each grid cell's cover as a CSS `background-image` pointing straight at the full-resolution source file. There was no thumbnailing/resize step — the grid downscaled to a ~150px tile with CSS, but the browser still fetched the whole multi-MB file and **decoded the full-resolution JPEG into an uncompressed bitmap** first.

Tolerable for most platforms, pathological for image-heavy "document" platforms. Measured on eXoIF `Images/IF Magazines/Box - Front` (600-DPI magazine cover scans): 312 files, ~873 MB total, **avg 2.8 MB, max 20 MB**, dimensions up to **194 megapixels** → roughly **66 MB (typical) to ~775 MB (worst) of decoded bitmap per image**. Interactive Fiction covers average ~339 KB, which is why IF Magazines was dramatically the worst.

Symptoms were: scrolling, keyboard navigation, and **window resizing** sluggish (each remounts/re-rasterizes cells → re-fetch from the slow eXoDOS data drive + giant decode); list view unaffected (no covers); under enough simultaneous visible cells the decoded-bitmap + GPU-texture memory ballooned into the GBs and the renderer/GPU process OOM-crashed to a **white screen**. Game *selection* was fine (single carousel decode). Profiling confirmed the playlist sidebar and search were NOT involved (sub-ms) — the original "it's the playlists" hypothesis was a red herring.

**What was done (solution 1 below):**
- `fileServer.ts`: `_ensureThumbnail(filePath, maxEdge)` serves a downscaled, persistently-cached JPEG on `?w=N` requests. Decodes with `sharp` (libvips **shrink-on-load**, so the full-res bitmap is never materialized — no OOM even on the 195 MP scans), writes `<configFolder>/cache/thumbs/<sha1(path|size|mtime|w)>.jpg`, dedupes concurrent generations via an in-flight map, and falls back to the original image on error. Mirrors the existing `_ensureTiffPng` cache.
- `Util.ts`: `getGameThumbnailUrl()` appends `?w=512` (`GRID_THUMBNAIL_MAX_EDGE`), so the grid + RandomGames request thumbnails; the right-sidebar carousel/preview still request full-res.
- Result: covers drop from multi-MB / 66–775 MB decoded to **~40 KB / ~0.7 MB decoded**.

**Residual trade-offs / follow-ups:**
- **First-view warm-up:** generation is lazy and one-time — ~0.1 s typical, up to ~5 s for the 195 MP scans (partly USB-NTFS read). The cell stays blank during generation (libvips runs on libuv's threadpool, so it doesn't block the server); every later launch reads the cached ~40 KB file instantly. A background pre-warm pass could hide this but adds LaunchBox-style complexity — deliberately not done.
- **Packaging:** `sharp`/libvips needs `asarUnpack: ["**/node_modules/sharp/**", "**/node_modules/@img/**"]` in `gulpfile.js` — the native `.node` and the libvips `.so`/`.dylib` must live on disk; they cannot be `dlopen`-ed from inside the asar (the AppImage failed at runtime with `ERR_DLOPEN_FAILED: libvips-cpp.so... cannot open shared object file` without this).
  Every release target builds on a native runner (Linux x64, Linux arm64, macOS arm64, macOS Intel x64), so `npm ci` installs the correct per-arch `@img/sharp-*` binary directly — no cross-arch install or `@electron/universal` merge handling is needed. Verify each release target actually launches after a sharp/Electron bump. See also the macOS Intel runner sunset below.
- Adds a native dependency (`sharp`/libvips) → see the GLib-GObject-CRITICAL smell below.

**Alternatives that were considered:** (2) in-memory cache only — re-pays the expensive decode every session, doesn't fix slow-on-every-start; (3) switch to `<img decoding="async" loading="lazy">` — moves decode off the main thread but doesn't shrink the bitmaps, so doesn't fix OOM (only a complement); (4) offline pre-generation (LaunchBox's approach) — lowest runtime cost but the most complexity.

---

## sharp/libvips emits GLib-GObject-CRITICAL log spam in the Electron backend
**Priority:** Low
**Severity:** Low (cosmetic)
**Effort:** Low (to suppress) / High (to truly fix)

**Issue:**
With the thumbnail cache (above), every image `sharp` transforms in the forked backend process emits a burst of:
```
GLib-GObject-CRITICAL **: g_object_ref: assertion 'G_IS_OBJECT (object)' failed
GLib-GObject-CRITICAL **: g_object_unref: assertion 'G_IS_OBJECT (object)' failed
```
to the backend's stderr (visible only when running from a terminal; the backend is `fork`ed with `silent: false` in `Main.ts`, so its stderr is inherited).

**Cause:** the classic "two glib instances in one process" symptom — `sharp`'s prebuilt binary bundles its own libvips+glib, and the Electron-forked backend already has a glib in its address space. libvips `ref`/`unref` on its `VipsImage`/operation objects trips the `G_IS_OBJECT` type check against the *other* glib instance. The real refcounting is handled by the correct instance, so **output is correct and the process exits cleanly** — it's spurious, non-fatal noise (`CRITICAL` is GLib's name for a *recoverable* assertion).

**Trade-offs:**
- ✅ Functionally harmless: thumbnails generate correctly, no crash/leak observed
- ✅ Invisible to end users (packaged builds have no terminal)
- ❌ Clutters the terminal during development

**Potential Solutions:**
1. **Ignore it (current choice).** Cosmetic; not seen by end users.
2. **Filter the backend child's stderr:** in `Main.ts` fork with `silent: true`, forward stdout, and forward stderr line-by-line except lines matching `GLib-GObject-CRITICAL`. ~10 lines, localized, no sharp/packaging impact.
3. **Eliminate the duplicate glib** by building `sharp` against a system libvips (single glib instance). The "proper" fix, but reintroduces the native-dependency/packaging complexity we are otherwise avoiding.

**Recommendation:** Ignore (1) for now — it's cosmetic and end users never see it. Revisit only if actual crashes/hangs ever occur *during* image processing (not just these log lines), in which case (3) becomes warranted.

---

## macOS Intel build depends on the soon-to-be-retired `macos-15-intel` runner
**Priority:** Medium
**Severity:** Medium (release will break for Intel Macs when the runner is removed)
**Effort:** Low (to drop Intel) / High (to keep Intel without a native runner)

**Issue:**
The macOS Intel (x64) build — shipped as the **legacy** Electron 37 build — runs on GitHub's `macos-15-intel` runner (`build-legacy-mac` in `release.yml` / `beta-release.yml` / `build.yml`). It is built natively (rather than cross-compiled / universal) specifically so `npm ci` installs the correct `@img/sharp-darwin-x64` binary; the previous universal-from-arm64 build shipped no x64 sharp and crashed on Intel Macs with `Could not load the "sharp" module using the darwin-x64 runtime`.

`macos-15-intel` is GitHub's **last** Intel macOS runner and is scheduled for removal **~August 2027**, after which no GitHub-hosted x86_64 macOS runner exists. The Apple Silicon (arm64) build on `macos-latest` is unaffected.

**Trade-offs:**
- ✅ Native build → correct per-arch sharp/libvips with zero cross-arch hacks (no `@electron/universal` merge, no `x64ArchFiles`)
- ✅ Matches the Linux per-arch native-runner pattern
- ❌ Time-bombed: the Intel job will fail once `macos-15-intel` is retired
- ❌ Two separate `.dmg`s (arm64 + Intel) instead of one universal download

**Potential Solutions (when the runner is removed):**
1. **Drop Intel macOS support** — Apple-Silicon-only, matching Apple's own x86_64 EOL. Simplest.
2. **Cross-build a universal app on arm64 again** — requires re-introducing both-arch `@img/sharp-*` into `node_modules` (npm prunes the other arch on each `npm install`, so this needs a temp-prefix-install-and-copy step) plus the `@electron/universal` merge config.
3. **Self-hosted Intel Mac runner.**

**Recommendation:** Leave as-is until `macos-15-intel` is actually retired; reassess Intel demand then and most likely take (1).

---

## Contributing

When adding new code to this project:
- Check this file for related smells before implementing
- Consider if your changes make existing smells worse
- Update this file if you introduce a new smell or fix an existing one
- Don't feel obligated to fix every smell - some are intentional trade-offs

This file is for awareness, not for creating technical debt guilt. Ship working code first, optimize later.
