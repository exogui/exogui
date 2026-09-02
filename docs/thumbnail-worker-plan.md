# Plan: move thumbnail generation into a recyclable worker process

**Status:** **implemented.** `thumbnailWorker.ts` / `thumbnailPool.ts` are in, `fileServer.ts`
no longer loads sharp, and the back process stays flat at ~102 MB across 480 cold thumbnails
where it previously reached 1149 MB. Verified in a packaged AppImage: the worker forks correctly
from inside `app.asar` (the one risk this plan flagged as unverifiable from source), recycles, and
no exogui process maps `libvips-cpp` any more.

The reporter's SIGSEGV is a **separate, still-unexplained problem** — see "Still unknown". The
worker contains it rather than fixing it: a crash now costs a worker, and the pool logs the source
path that killed it.

Related: [image-caching.md](image-caching.md), `src/back/backend/fileServer.ts`, `SMELLS.md`.

## The bug

The back process dies while the game grid is loading cold thumbnails. The window
survives with a dead socket and every request hangs. Two user reports, both on
a full eXoDOS collection on an external USB drive, both on 1.2.58.

### What the reports prove

From the renderer console:

```
SharedSocket Closed (Code: 1006, Clean: false, Reason: "", URL: "ws://127.0.0.1:20001/")
GET http://127.0.0.1:12101/Images/... net::ERR_CONNECTION_RESET
GET http://127.0.0.1:12101/Images/... net::ERR_CONTENT_LENGTH_MISMATCH 200 (OK)
GET http://127.0.0.1:12101/Images/... net::ERR_CONNECTION_REFUSED
```

The file server (12101) and the websocket server both live in the back process,
and both stop answering at the same instant. The error progression is a process
death in slow motion: sockets reset, then a response truncated mid-`stream.pipe`,
then nothing listening.

From `journalctl` on the reporter's machine:

```
09:01:43  Back - Opened Websocket                      (back starts)
09:01:52  VLC: stopping                                (last line it ever logs)
09:01:52  systemd-coredump: Process 3139 (exogui) of user 1000
          terminated abnormally with signal 11/SEGV
09:02:41  Process 3139 dumped core.
          Stack trace of thread 3158:
          #0  0x0000000000000000 n/a (n/a + 0x0)
```

`coredumpctl` adds the parts that matter:

```
TID: 3158 (libuv-worker)
Signal: 11 (SEGV) si_code: SI_TKILL
COREFILE: truncated          Size on Disk: 9.1M
```

Four things to take from that:

- **SIGSEGV, not the OOM killer.** The process segfaults; it is not SIGKILLed by
  the kernel.
- **The crashing thread is a libuv threadpool worker**, not the main thread
  (3139). The VLC socket code and the whole JS event loop run on the main
  thread, so the "VLC: stopping" line immediately before the crash is a
  coincidence of timing, not the cause. sharp's N-API async work runs on the
  libuv pool — but so does every async fs operation, so this does **not** single
  out sharp.
- **`si_code: SI_TKILL`** means the signal was delivered by `tkill`/`tgkill` from
  user space, not raised by the MMU (which would give `SEGV_MAPERR` or
  `SEGV_ACCERR`). That is the signature of a handler catching the original fault
  and re-raising, so the captured register state is post-handler.
- **The core is truncated** — 9.1 MB for an Electron-sized process, and gdb says
  `has a segment extending past end of file` / `Failed to read a valid object
  file image from memory`. **The `#0 0x0000000000000000` frame is therefore an
  artifact, not evidence.** An earlier revision of this document read it as a
  jump through a null function pointer and inferred memory corruption from it.
  That inference was wrong and has been removed.
- **Nine seconds after start.** Game loading takes ~3.3s, so the crash lands
  within a few seconds of the grid starting to request images.

The dump does confirm sharp was loaded, at versions identical to the dev box:
`libvips-cpp.so.8.18.3` and `sharp-linux-x64-0.35.1.node`. It also shows
`anon_inode:[io_uring]` mapped — see "still unknown".

### Measurements

Reproduced locally against a real collection. Backend RSS while generating cold
thumbnails, JS heap logged alongside (via `diagnostics=true`):

| large thumbnails generated | backend RSS | JS heapUsed |
|---|---|---|
| 0 | 108 MB | 8 MB |
| 120 | 372 MB | 8 MB |
| 240 | 631 MB | 8 MB |
| 360 | 890 MB | 8 MB |
| 480 | 1149 MB | 8 MB |
| 800 (standalone harness) | 1464 MB | — |

Linear, no plateau, ~1.7–2.2 MB retained per large thumbnail. The JS heap never
moves, so none of it is a JS leak — it is native memory in sharp/libvips that is
never returned to the OS.

Small box art in isolation looks fine: 700 typical covers (avg 126 KB) plateau at
165 MB. That turns out to be misleading at scale.

**Full-collection sweep.** Every image in a real collection — 50,141 files
(33,958 PNG, 15,314 JPG, 858 GIF, 6 TIFF, 5 JPEG) — through the exact
`fileServer` pipeline, six at a time:

```
start                106 MB
 6,000 images      1,889 MB
20,000 images      7,158 MB
36,000 images     10,707 MB
48,000 images     14,477 MB      <- peak
50,141 images     13,374 MB      DONE, 0 decode errors
```

Averaged, ~0.27 MB retained per image, and it never comes back. A user who
browses a whole collection with a cold cache takes the back process to **well
over 10 GB**. That is a real defect on its own, independent of any crash, and it
is what justifies this plan.

### Why it kills that machine and not a dev box

- A dev box has a warm `cache/thumbs` (8520 entries here), so almost no sharp
  work happens. The reporter's cache is cold.
- `_ensureThumbnail` has **no concurrency limit**. `_thumbInFlight` dedupes
  identical cache paths only, so N distinct images means N concurrent sharp
  pipelines. This is still worth capping, but measurement shows the peak is far
  lower than first assumed (411 MB for six concurrent 200 Mpx PNGs), so it is
  not on its own an explanation for the crash.
- The platforms in the reporter's log at the moment of death are exactly the
  large-scan ones: MS-DOS Books, Catalogs, Magazines & Newsletters, Videos.

So there is real, measured retention in a process that also owns the websocket and
the file server. What is *not* established is that this retention is what kills
it — the timing does not fit, and the peak-memory story that did fit turned out
to be false.

## Approach: run sharp in a recyclable child process

The back process should not load libvips at all. Thumbnail and TIFF work moves to
a child process that the file server owns, recycles, and can lose without dying.

If the crash does turn out to be in the image path, this contains both halves of
it at once:

- **Retention** — process exit returns everything to the OS, whatever the
  allocator does. This is the only mitigation that is allocator-independent.
- **Crash isolation** — a SIGSEGV in libvips kills a worker, not the launcher.
  The file server already degrades to serving the original image when a
  thumbnail fails, so the UI keeps working.

Worker boot cost is measured at **~1.1s** (electron-node + loading sharp), so the
worker must be long-lived and recycled in batches, never spawned per image.

## Implementation

### 1. Worker entry point — `src/back/backend/thumbnailWorker.ts`

- Owns the only `require("sharp")` in the codebase.
- Reads jobs from `process.on("message")`, replies via `process.send`.
- Does one job at a time. Serialising inside the worker is what caps peak memory
  to a single decode.
- Writes the output file itself and returns a path. No image bytes cross the IPC
  channel.
- Reports `process.memoryUsage().rss` with every reply so the parent can decide
  when to recycle.

Message shapes:

```ts
type ThumbnailJob =
  | { id: number; kind: "thumb"; src: string; dest: string; maxEdge: number }
  | { id: number; kind: "tiff"; src: string; dest: string };

type ThumbnailResult =
  | { id: number; ok: true; rss: number }
  | { id: number; ok: false; error: string; rss: number };
```

Move `MAX_INPUT_PIXELS`, `THUMBNAIL_QUALITY` and the sharp pipelines here
verbatim from `fileServer.ts`.

### 2. Pool — `src/back/backend/thumbnailPool.ts`

Owns one worker, a FIFO queue, and the recycling policy.

- **Lazy spawn.** No worker until the first job, so a warm cache costs nothing.
- **Recycle** after N completed jobs *or* when a reply reports RSS over a
  threshold. Start with **100 jobs / 400 MB** and tune against the real
  collection. Recycling = stop feeding it, `disconnect()`, `kill()` after a
  grace period, spawn fresh on the next job.
- **Idle timeout** (~60s) so a finished browsing session does not hold a few
  hundred MB.
- **Per-job timeout** (~60s; a 200 Mpx PNG off USB is slow) — on expiry kill the
  worker, fail that job, respawn.
- **Crash handling.** On `exit` with a signal, fail the in-flight job and **log
  the source path** — that line names the image that killed it, which is the
  single most useful diagnostic we do not currently have. Respawn on the next
  job.
- **Poison memo.** Record images that crashed or timed out and refuse to retry
  them for the rest of the session, otherwise every grid scroll past that tile
  kills another worker. Consider persisting a marker next to the cache entry so
  it survives restarts.

Fork the worker the same way `Main.ts` forks the back: `child_process.fork` on
the built `build/back/backend/thumbnailWorker.js`.

### 3. `fileServer.ts`

- Delete the `sharp` require and both call sites.
- `_ensureThumbnail` / `_convertTiffToPng` keep their signatures and their cache
  path logic, and submit a job to the pool instead of running sharp inline.
- Keep `_thumbInFlight` — it dedupes identical requests before they reach the
  queue.
- Keep the existing fallback: on failure, serve the original file.

### 4. Packaging

The worker is under `src/back/`, so the SWC build picks it up with no gulpfile
change. Two things to verify, because neither shows up in `npm run start`:

- `build/back/backend/thumbnailWorker.js` exists after `npm run build`.
- **`fork()` on a path inside `app.asar` works in a packaged build.** Verify on a
  real AppImage, not just from source. If it does not, unpack the worker via
  `asarUnpack` in the electron-builder config.

## Verification

1. **Unit** — pool against a fake worker: queue ordering, recycle after N,
   recycle on RSS, crash mid-job respawns, timeout kills, poison memo holds.
2. **Integration** — real worker, a handful of real images, assert the output
   files are produced and the parent's RSS stays flat.
3. **The regression that started this.** Clear `cache/thumbs`, start with
   `diagnostics=true`, fire 480 cold thumbnail requests at the file server at
   concurrency 6, and assert backend RSS stays flat. Before: 108 → 1149 MB.
   The harness used to produce the table above drives the real file server over
   HTTP with `?w=<n>` at an unused width to force cache misses without
   destroying an existing cache.
4. **On the reporter's machine** — cold cache, full collection, external drive,
   `diagnostics=true`. That is the only configuration that has ever crashed.

## Do not bother with these — already measured, all no-ops

Recorded so nobody spends the afternoon again:

- **`MALLOC_ARENA_MAX=2`** — flattens the curve completely under plain node
  (342 MB → 207 MB, flat across 800 decodes) and does **nothing** in the real
  app (1149 MB, unchanged). Electron replaces malloc with PartitionAlloc, so the
  glibc arena knob is inert. This was committed and reverted; do not re-add it.
- **`sharp.cache(false)`** and **`sharp.concurrency(1)`** — no measurable effect
  on retention.
- **`sequentialRead: true`** — no effect (124 MB peak either way on a 31 Mpx
  PNG). sharp already uses sequential access for a simple resize pipeline.
- **Tightening `limitInputPixels`** — will not prevent this. Real scans are
  ~200 Mpx, under sharp's 268 Mpx default, so no cap that still permits genuine
  content would have blocked the offending images. (There *is* an uncommitted
  change in `fileServer.ts` replacing `limitInputPixels: false` with a 500 Mpx
  bound. Keep it as hardening against a corrupt header claiming absurd
  dimensions, but it is not a fix.)

## Still unknown — read this before writing any code

Two mechanisms proposed here were tested locally and **disproved**:

- *"A 200 Mpx PNG must be fully decoded, so six concurrent decodes is ~5 GB."*
  False. A synthetic 200 Mpx PNG through the exact `fileServer` pipeline peaks at
  **176 MB**, and six concurrently at **411 MB**. libvips streams PNG through the
  resize; there is no full-bitmap materialisation. The paragraph about PNG having
  no shrink-on-load was wrong.
- *"`failOn: \"none\"` lets a corrupt file drive the decoder off a cliff."*
  Not reproducible. 43 malformed variants of a real 27 MB scan (truncations from
  2% to 99%, plus scattered byte flips) all completed or raised a clean JS error.
  None crashed.
- *"One poisoned image in the collection kills the decoder."* No support. The
  full 50,141-image sweep above completed with **zero decode errors and no
  crash**. libvips emitted only cosmetic `VIPS-WARNING` lines (bad ICC profiles,
  unknown EXIF resolution units). A damaged file unique to the reporter's drive
  is still possible — his was mounted with `EXT4-fs (sda1): recovery complete`,
  i.e. an unclean unmount — but nothing in a healthy collection does it.

The reporter has also now run the two environment tests: `UV_USE_IO_URING=0` and
`UV_THREADPOOL_SIZE=1` both changed nothing. The second is the more informative:
it serialises every native async job, so the crash survives with only one decode
running at a time. Concurrency is not the trigger.

What survives is the retention measurement, which is solid but far too slow to
explain a crash nine seconds in.

So the root cause is **not established**, and the crashing thread being a
*libuv* worker rather than a libvips one widens the field rather than narrowing
it.

### Ask the reporter to run these, cheapest first

Do these before committing to the worker. Each line is one experiment. Run from
the eXoDOS directory, and **delete `exogui/cache/thumbs` before each run** — a
warm cache means no image work and the crash will not reproduce.

Keep `--no-sandbox` **before** `diagnostics=true`. `getArgs()` in
`src/main/index.ts` reads `process.argv.slice(2)`, which is right when running
`electron <script> <args>` in development but drops the first argument in a
packaged build, where argv is `[exe, ...args]` and there is no script path. With
`--no-sandbox` in front it lands in the slot that gets dropped and the flag after
it is parsed. Worth fixing separately — as it stands, `./exogui.AppImage
diagnostics=true` on its own is silently ignored.

```bash
# Baseline: confirm it still crashes, and capture full logs.
# `diagnostics=true` writes eXoDOS/exogui/exogui-debug.log and turns on the
# lifecycle hooks; `--no-sandbox` is needed where unprivileged userns is off.
./exogui.AppImage --no-sandbox diagnostics=true 2>&1 | tee ~/exogui-baseline.log

# Test 1 — is this libuv's io_uring rather than anything to do with images?
# The dump shows anon_inode:[io_uring] mapped; Electron 39.8.7 ships libuv
# 1.51.0, which uses io_uring for threadpool fs work and has had
# kernel-dependent bugs there. If the crash disappears, the image path is
# innocent and this whole plan is aimed at the wrong subsystem.
UV_USE_IO_URING=0 ./exogui.AppImage --no-sandbox diagnostics=true 2>&1 | tee ~/exogui-nouring.log

# Test 2 — is it concurrency-dependent? Serialises the libuv threadpool, so
# only one native async job (sharp decode or fs op) runs at a time.
UV_THREADPOOL_SIZE=1 ./exogui.AppImage --no-sandbox diagnostics=true 2>&1 | tee ~/exogui-1thread.log

# Test 4 — is it the drive the AppImage itself lives on? His AppImage sits on
# the same USB disk as the collection. An AppImage executes from a FUSE-mounted
# squashfs, so sharp/libvips code pages are demand-faulted off that disk while
# it is also being hammered by image reads. Running the binary from internal
# storage (collection still on USB) isolates that.
cp /run/media/morgan/*/Games/eXoDOS/exogui.x86_64.AppImage ~/
cd /run/media/morgan/*/Games/eXoDOS
~/exogui.x86_64.AppImage --no-sandbox diagnostics=true 2>&1 | tee ~/exogui-localbin.log

# Test 5 — get an untruncated core, then a real backtrace. The core we have is
# 9.1 MB and truncated, which is why it has no usable stack. Worth more than
# everything else here combined, and it must be collected BEFORE any fix lands.
sudo sed -i 's/^#\?ProcessSizeMax=.*/ProcessSizeMax=8G/;s/^#\?ExternalSizeMax=.*/ExternalSizeMax=8G/' /etc/systemd/coredump.conf
sudo systemctl daemon-reload
ulimit -c unlimited
./exogui.AppImage --no-sandbox diagnostics=true      # reproduce the crash
coredumpctl gdb exogui                               # then at the prompt: bt
```

What to look for: whether the crash still happens at all, and in the baseline log
the last `Back -` line before it dies. On 1.2.59-beta and later `diagnostics=true`
also prints `[Diagnostics][back] memory rss=...` every 30s, which shows whether
the back was growing before it went; 1.2.58 does not have that line.

Remaining open points:

- **The glib warnings.** The back emits thousands of `g_object_unref: assertion
  'G_IS_OBJECT (object)' failed` (see `SMELLS.md`). Still unexplained, still not
  proven harmless, but no longer supported by the null-frame reading.
- **Recycle thresholds.** 100 jobs / 400 MB are guesses. Tune against a cold run
  over the real collection.
- **Pre-generating the cache** on first run was considered and set aside. If
  worker recycling turns out to make cold browsing too slow, revisit it as a
  separate piece of work with its own progress UI.
