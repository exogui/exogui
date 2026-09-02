import { ThumbnailJob, ThumbnailResult } from "./thumbnailTypes";

// sharp is a CommonJS module whose export is the function itself. The backend
// SWC build uses `noInterop`, so a default `import` would compile to a
// `.default` access that is undefined at runtime — require it directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof import("sharp").default = require("sharp");

/** JPEG quality for generated thumbnails. */
const THUMBNAIL_QUALITY = 80;

/**
 * Ceiling on the source image sharp will decode. The largest real eXoDOS art is a ~31 megapixel
 * magazine scan, so this passes everything genuine while still refusing an image whose header
 * claims absurd dimensions - decoding one of those would allocate gigabytes in a single go.
 */
const MAX_INPUT_PIXELS = 500_000_000;

function open(src: string) {
    return sharp(src, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS });
}

async function runJob(job: ThumbnailJob): Promise<void> {
    if (job.kind === "thumb") {
        await open(job.src)
        .rotate()
        .resize({
            width: job.maxEdge,
            height: job.maxEdge,
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
        .toFile(job.dest);
    } else {
        await open(job.src).png().toFile(job.dest);
    }
}

function reply(result: ThumbnailResult): void {
    process.send?.(result);
}

process.on("message", (job: ThumbnailJob) => {
    runJob(job)
    .then(() => reply({ id: job.id, ok: true, rss: process.memoryUsage().rss }))
    .catch((error) =>
        reply({ id: job.id, ok: false, error: `${error}`, rss: process.memoryUsage().rss })
    );
});

// The parent recycles us by closing the IPC channel; exit rather than linger.
process.on("disconnect", () => process.exit(0));
