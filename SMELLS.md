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

## macOS legacy build depends on the soon-to-be-retired `macos-15-intel` runner
**Priority:** Low
**Severity:** Low (only the legacy Electron 37 build breaks when the runner is removed; modern macOS is unaffected)
**Effort:** Low (to drop the legacy build)

**Issue:**
Modern macOS ships as a **single universal `.dmg`** (arm64 + x64), built on `macos-latest` (arm64) via the `macOS universal` matrix entry in `release.yml` / `beta-release.yml` / `build.yml`. Because `npm ci` on the arm64 runner installs only `@img/sharp-darwin-arm64`, a dedicated **"Add x64 sharp binaries for universal macOS build"** step temp-prefix-installs `@img/sharp-darwin-x64` + `@img/sharp-libvips-darwin-x64` (`npm install --prefix … --os=darwin --cpu=x64`) and copies them into `node_modules/@img` before packing. Both arch packages then live at distinct paths, so both universal slices carry identical unpacked `node_modules`, `@electron/universal` merges cleanly (no `x64ArchFiles` needed), and sharp's loader picks the right binary at runtime per slice.

Separately, a **legacy** Electron 37 x64 build (`macOS x86_legacy` matrix entry) still runs natively on GitHub's `macos-15-intel` runner to support **older macOS versions** that Electron 39 dropped. That is an OS-version concern, orthogonal to CPU arch — the universal build already covers modern Intel Macs.

`macos-15-intel` is GitHub's **last** Intel macOS runner and is scheduled for removal **~August 2027**, after which no GitHub-hosted x86_64 macOS runner exists. Only the legacy build depends on it; the universal build on `macos-latest` is unaffected.

**Trade-offs:**
- ✅ One universal download for all modern Macs (arm64 + Intel) instead of two separate `.dmg`s
- ✅ Correct per-arch sharp/libvips in both slices via the both-arch install
- ❌ Legacy build is time-bombed: the `macOS x86_legacy` job will fail once `macos-15-intel` is retired
- ❌ Universal `.dmg` is larger (bundles both Electron slices + both sharp arches)

**Potential Solutions (when the runner is removed):**
1. **Drop the legacy build** — modern Intel Macs stay covered by the universal build; only pre-Electron-39 macOS versions lose support. Simplest.
2. **Self-hosted Intel Mac runner** — only if old-macOS support must continue.

**Recommendation:** Leave as-is until `macos-15-intel` is actually retired; then most likely take (1), since the universal build already serves all current-macOS Intel users.

---

## Contributing

When adding new code to this project:
- Check this file for related smells before implementing
- Consider if your changes make existing smells worse
- Update this file if you introduce a new smell or fix an existing one
- Don't feel obligated to fix every smell - some are intentional trade-offs

This file is for awareness, not for creating technical debt guilt. Ship working code first, optimize later.
