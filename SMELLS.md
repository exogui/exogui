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

## sharp/libvips emits GLib-GObject-CRITICAL log spam in the Electron backend
**Priority:** Low
**Severity:** Low (cosmetic)
**Effort:** Low (to suppress) / High (to truly fix)

**Issue:**
With the thumbnail cache, every image `sharp` transforms in the forked backend process emits a burst of:
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
The macOS Intel (x64) build — shipped as the **legacy** Electron 37 build — runs on GitHub's `macos-15-intel` runner (the `macOS (Legacy)` matrix entry in `release.yml` / `build.yml`, and the `build-legacy-mac` job in `beta-release.yml`). It is built natively (rather than cross-compiled / universal) specifically so `npm ci` installs the correct `@img/sharp-darwin-x64` binary; the previous universal-from-arm64 build shipped no x64 sharp and crashed on Intel Macs with `Could not load the "sharp" module using the darwin-x64 runtime`.

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
