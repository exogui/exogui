import { IAppConfigData } from "@shared/config/interfaces";
import * as crypto from "crypto";
import * as http from "http";
import * as fs from "fs";
import { Mime } from "mime";
import * as path from "path";
import { PNG } from "pngjs";
import * as UTIF from "utif";
import { getFilePathExtension } from "@shared/Util";
import { LogFunc } from "@back/types";
import { startFileServer } from "./serverHelper";

// sharp is a CommonJS module whose export is the function itself. The backend
// SWC build uses `noInterop`, so a default `import` would compile to a
// `.default` access that is undefined at runtime — require it directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof import("sharp").default = require("sharp");

const TIFF_EXTS = new Set([".tif", ".tiff"]);

/** Source formats we will downscale into cached thumbnails on `?w=` requests. */
const THUMBNAIL_EXTS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
]);

/** Upper bound on a requested thumbnail edge, to bound cache/work. */
const MAX_THUMBNAIL_EDGE = 2048;

/** JPEG quality for generated thumbnails. */
const THUMBNAIL_QUALITY = 80;

export interface IAssetsPaths {
    exodosPath: string;
    imageFolderPath: string;
    logoFolderPath: string;
}

export class FileServer {
    private _server = new http.Server(this._onFileServerRequest.bind(this));
    private _port = -1;

    get port() {
        return this._port;
    }

    get server() {
        return this._server;
    }

    constructor(
        private readonly _config: IAppConfigData,
        private readonly _log: LogFunc,
        private readonly _cacheFolder: string,
    ) {}

    private _tiffCacheFolder(): string {
        return path.join(this._cacheFolder, "tiff");
    }

    private async _resolveTiffCachePath(filePath: string): Promise<string> {
        const stat = await fs.promises.stat(filePath);
        const key = crypto.createHash("sha1").update(`${filePath}|${stat.size}|${stat.mtimeMs}`).digest("hex");
        return path.join(this._tiffCacheFolder(), `${key}.png`);
    }

    private async _ensureTiffPng(filePath: string): Promise<string> {
        const cachePath = await this._resolveTiffCachePath(filePath);
        try {
            await fs.promises.access(cachePath, fs.constants.R_OK);
            return cachePath;
        } catch { /* generate below */ }

        await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
        const tmpPath = `${cachePath}.tmp-${process.pid}-${Date.now()}`;
        await this._convertTiffToPng(filePath, tmpPath);
        await fs.promises.rename(tmpPath, cachePath);
        return cachePath;
    }

    /** In-flight thumbnail generations, keyed by cache path, to dedupe concurrent requests. */
    private _thumbInFlight: Map<string, Promise<string>> = new Map();

    private _thumbsCacheFolder(): string {
        return path.join(this._cacheFolder, "thumbs");
    }

    private async _resolveThumbCachePath(
        filePath: string,
        maxEdge: number
    ): Promise<string> {
        const stat = await fs.promises.stat(filePath);
        const key = crypto
        .createHash("sha1")
        .update(`${filePath}|${stat.size}|${stat.mtimeMs}|${maxEdge}`)
        .digest("hex");
        return path.join(this._thumbsCacheFolder(), `${key}.jpg`);
    }

    /**
     * Return a path to a cached JPEG thumbnail of `filePath` fitting within
     * `maxEdge`x`maxEdge`, generating it (once) if missing. sharp decodes with
     * shrink-on-load, so the full-resolution bitmap is never materialized.
     */
    private async _ensureThumbnail(
        filePath: string,
        maxEdge: number
    ): Promise<string> {
        const cachePath = await this._resolveThumbCachePath(filePath, maxEdge);
        try {
            await fs.promises.access(cachePath, fs.constants.R_OK);
            return cachePath;
        } catch {
            /* generate below */
        }

        const inFlight = this._thumbInFlight.get(cachePath);
        if (inFlight) {
            return inFlight;
        }

        const task = (async () => {
            await fs.promises.mkdir(path.dirname(cachePath), {
                recursive: true,
            });
            const tmpPath = `${cachePath}.tmp-${process.pid}-${Date.now()}`;
            await sharp(filePath, { failOn: "none", limitInputPixels: false })
            .rotate()
            .resize({
                width: maxEdge,
                height: maxEdge,
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
            .toFile(tmpPath);
            await fs.promises.rename(tmpPath, cachePath);
            return cachePath;
        })().finally(() => this._thumbInFlight.delete(cachePath));

        this._thumbInFlight.set(cachePath, task);
        return task;
    }

    private async _convertTiffToPng(tiffPath: string, pngPath: string): Promise<void> {
        const buffer = await fs.promises.readFile(tiffPath);
        const ifds = UTIF.decode(buffer);
        if (!ifds.length) {
            throw new Error("TIFF contains no image pages");
        }
        const page = ifds[0];
        UTIF.decodeImage(buffer, page);
        const rgba = UTIF.toRGBA8(page);

        const png = new PNG({ width: page.width, height: page.height });
        png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);

        await new Promise<void>((resolve, reject) => {
            const out = fs.createWriteStream(pngPath);
            out.on("error", reject);
            out.on("finish", resolve);
            png.pack().on("error", reject).pipe(out);
        });
    }

    public async start() {
        console.log(
            `Starting file server with ${this._config.imagesPortMin} - ${this._config.imagesPortMax} port.`
        );
        this._port = await startFileServer({
            log: this._log,
            maxPort: this._config.imagesPortMax,
            minPort: this._config.imagesPortMin,
            server: this._server,
        });
        console.log(`Started file server on port ${this._port}`);
    }

    private _onFileServerRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ): void {
        try {
            let urlPath = decodeURIComponent(req.url || "");

            // Parse and remove the get parameters. `w` requests a downscaled
            // thumbnail (used by the game grid) instead of the full-res image.
            let thumbWidth: number | undefined;
            const qIndex = urlPath.indexOf("?");
            if (qIndex >= 0) {
                const w = new URLSearchParams(
                    urlPath.substring(qIndex + 1)
                ).get("w");
                if (w) {
                    const parsed = parseInt(w, 10);
                    if (Number.isFinite(parsed) && parsed > 0) {
                        thumbWidth = Math.min(parsed, MAX_THUMBNAIL_EDGE);
                    }
                }
                urlPath = urlPath.substr(0, qIndex);
            }

            // Remove all leading slashes
            for (let i = 0; i < urlPath.length; i++) {
                if (urlPath[i] !== "/") {
                    urlPath = urlPath.substr(i);
                    break;
                }
            }

            const index = urlPath.indexOf("/");
            const firstItem = (
                index >= 0 ? urlPath.substr(0, index) : urlPath
            ).toLowerCase(); // First filename in the path string ("A/B/C" => "A" | "D" => "D")
            switch (firstItem) {
                // Image folder
                case "images":
                    {
                        const imageFolder = path.join(
                            this._config.exodosPath,
                            this._config.imageFolderPath
                        );
                        const filePath = path.join(
                            imageFolder,
                            urlPath.substr(index + 1)
                        );
                        if (filePath.startsWith(imageFolder)) {
                            this._serveFile(req, res, filePath, thumbWidth);
                        }
                    }
                    break;

                case "videos":
                    {
                        const videosFolder = path.join(
                            this._config.exodosPath,
                            "Videos"
                        );
                        const filePath = path.join(
                            videosFolder,
                            urlPath.substring(index + 1)
                        );
                        if (filePath.startsWith(videosFolder)) {
                            this._serveFile(req, res, filePath);
                        }
                    }
                    break;

                // Logos folder
                case "logos":
                    {
                        const logoFolder = path.join(
                            this._config.exodosPath,
                            this._config.logoFolderPath
                        );
                        const filePath = path.join(
                            logoFolder,
                            urlPath.substr(index + 1)
                        );
                        if (filePath.startsWith(logoFolder)) {
                            this._serveFile(req, res, filePath);
                        }
                    }
                    break;

                // Exodos directory, serving html from there
                case "exo": {
                    const extension = getFilePathExtension(urlPath);
                    if (
                        extension.toLocaleLowerCase() === "html" ||
                        extension.toLocaleLowerCase() === "htm" ||
                        extension.toLocaleLowerCase() === "txt"
                    ) {
                        const filePath = path.join(
                            this._config.exodosPath,
                            urlPath
                        );
                        this._serveFile(req, res, filePath);
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                    break;
                }
                // Nothing
                default:
                    {
                        res.writeHead(404);
                        res.end();
                    }
                    break;
            }
        } catch (error) {
            console.warn(error);
        }
    }

    private _serveFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        filePath: string,
        thumbWidth?: number
    ): void {
        if (req.method === "GET" || req.method === "HEAD") {
            const ext = path.extname(filePath).toLowerCase();
            if (thumbWidth && THUMBNAIL_EXTS.has(ext)) {
                this._ensureThumbnail(filePath, thumbWidth)
                .then((thumbPath) => this._serveFile(req, res, thumbPath))
                .catch((err) => {
                    console.warn(`File server failed to create thumbnail "${filePath}": ${err}`);
                    // Degrade to the original image so the UI still shows something
                    this._serveFile(req, res, filePath);
                });
                return;
            }
            if (TIFF_EXTS.has(ext)) {
                this._ensureTiffPng(filePath)
                .then((pngPath) => this._serveFile(req, res, pngPath))
                .catch((err) => {
                    console.warn(`File server failed to convert TIFF "${filePath}": ${err}`);
                    res.writeHead(404);
                    res.end();
                });
                return;
            }
            fs.stat(filePath, (error, stats) => {
                if (error || (stats && !stats.isFile())) {
                    res.writeHead(404);
                    res.end();
                } else {
                    const contentType =
                        new Mime().getType(path.extname(filePath)) ||
                        "application/octet-stream";
                    const total = stats.size;
                    const range = req.headers.range;

                    if (range) {
                        const parts = range.replace(/bytes=/, "").split("-");
                        const start = parseInt(parts[0], 10);
                        const end = parts[1]
                            ? parseInt(parts[1], 10)
                            : total - 1;
                        const chunkSize = end - start + 1;

                        res.writeHead(206, {
                            "Content-Range": `bytes ${start}-${end}/${total}`,
                            "Accept-Ranges": "bytes",
                            "Content-Length": chunkSize,
                            "Content-Type": contentType,
                            "Access-Control-Allow-Origin": "*",
                        });

                        if (req.method === "GET") {
                            const stream = fs.createReadStream(filePath, {
                                start,
                                end,
                            });
                            stream.on("error", (error) => {
                                console.warn(
                                    `File server failed to stream file. ${error}`
                                );
                                stream.destroy();
                                if (!res.writableEnded) {
                                    res.end();
                                }
                            });
                            stream.pipe(res);
                        } else {
                            res.end();
                        }
                    } else {
                        res.writeHead(200, {
                            "Content-Type": contentType,
                            "Content-Length": total,
                            "Access-Control-Allow-Origin": "*",
                        });
                        if (req.method === "GET") {
                            const stream = fs.createReadStream(filePath);
                            stream.on("error", (error) => {
                                console.warn(
                                    `File server failed to stream file. ${error}`
                                );
                                stream.destroy();
                                if (!res.writableEnded) {
                                    res.end();
                                }
                            });
                            stream.pipe(res);
                        } else {
                            res.end();
                        }
                    }
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    }
}
