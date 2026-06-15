# Image Caching

This document describes how exogui serves images and how it caches generated
thumbnails. The relevant code lives in `src/back/backend/fileServer.ts` (backend
HTTP file server) and `src/renderer/Util.ts` (`getGameThumbnailUrl`).

## Overview

Images (box art, screenshots, logos, etc.) are served to the renderer by the
backend HTTP file server (see [architecture.md](architecture.md#file-server)):

```
http://localhost:<imagesPort>/Images/<platform>/<category>/<file>
```

Two of these requests are transformed and **persistently cached on disk** rather
than streamed as-is:

- **Grid thumbnails** — downscaled copies requested with a `?w=<px>` query.
- **TIFF images** — converted to PNG so the renderer (Chromium) can display them.

Cached output is written under the app's cache folder and reused across restarts.

## Why thumbnails are cached

Cover art in the eXo projects can be very large — magazine and book scans in
particular reach 600 DPI and ~200 megapixels (multi-MB files). The game grid
displays each cover in a small (~150–330 px) tile, but a browser still has to
download the full file and **decode the full-resolution image into an
uncompressed bitmap** before scaling it down. For the largest scans that is
hundreds of MB of bitmap per image, which makes grid scrolling/resizing sluggish
and can exhaust renderer memory.

To avoid this, the grid requests a downscaled thumbnail instead of the original.

## Thumbnail requests (`?w=N`)

- The grid and the "Random games" view build their image URLs via
  `getGameThumbnailUrl()`, which appends `?w=512` (`GRID_THUMBNAIL_MAX_EDGE`).
- The file server resizes the source to fit within an `N x N` box (aspect
  preserved, never upscaled), encodes it as JPEG, caches it, and serves the
  cached copy.
- Full-resolution consumers — the right-sidebar carousel, the full-screen media
  preview, and the 3D box viewer — request the image **without** `?w=`, so they
  always receive the original file.

Resizing uses [`sharp`](https://sharp.pixelplumbing.com/) (libvips), which decodes
JPEG with *shrink-on-load*: it produces the reduced-size image without ever
materializing the full-resolution bitmap, so even the largest scans are handled
cheaply.

To request a thumbnail at a different size (e.g. for HiDPI), change
`GRID_THUMBNAIL_MAX_EDGE` in `src/renderer/Util.ts` — no server change is needed.

## TIFF conversion

Chromium cannot render TIFF images. Any request for a `.tif`/`.tiff` file is
converted to PNG (via `sharp`, the same library used for thumbnails) and cached,
then the PNG is served. This applies to full-resolution TIFF requests.

## Cache location and invalidation

Both caches live under `<configFolder>/cache/`:

```
<configFolder>/cache/thumbs/<sha1(path|size|mtime|w)>.jpg   # thumbnails
<configFolder>/cache/tiff/<sha1(path|size|mtime)>.png       # TIFF -> PNG
```

- `<configFolder>` is the folder containing `config.json`/`preferences.json`
  (the app directory in a packaged build, the repository root in development).
- The cache key includes the source file's size and modification time, so a
  changed source image is regenerated automatically.
- The cache is disposable: deleting the `cache/` folder is safe — entries are
  regenerated lazily on the next request. It is git-ignored in development.

## First-view warm-up

Thumbnail generation is **lazy and one-time per image**: the first time a cover
becomes visible, the server generates and caches its thumbnail (typically well
under a second, but up to a few seconds for the largest 200 MP scans, partly
limited by source-drive read speed). During generation the tile stays blank;
generation runs on libvips' worker threads, so it does not block other requests.
Every subsequent launch reads the small cached file instantly.

## Dependencies

Thumbnailing adds a native dependency, [`sharp`](https://sharp.pixelplumbing.com/)
(prebuilt libvips). Packaged builds must unpack its native binaries from the asar
archive, and cross-platform releases need each target platform's `sharp` binary
present.
