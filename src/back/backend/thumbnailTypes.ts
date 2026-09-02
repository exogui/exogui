export type ThumbnailTask =
    | { kind: "thumb"; src: string; dest: string; maxEdge: number }
    | { kind: "tiff"; src: string; dest: string };

export type ThumbnailJob = ThumbnailTask & { id: number };

export type ThumbnailResult = {
    id: number;
    rss: number;
} & ({ ok: true } | { ok: false; error: string });
