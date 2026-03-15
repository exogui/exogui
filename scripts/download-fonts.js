/**
 * Downloads Liberation fonts (Regular, Bold, Italic, BoldItalic) into the fonts/ directory.
 * Run with: node scripts/download-fonts.js
 * Required before building Linux packages.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FONTS_DIR = path.join(__dirname, "../fonts");

const VERSION = "2.1.5";
const ARCHIVE_URL = `https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-${VERSION}.tar.gz`;
const ARCHIVE_PATH = path.join(FONTS_DIR, "liberation-fonts.tar.gz");

const FONTS_TO_EXTRACT = [
    "LiberationSans-Regular.ttf",
    "LiberationSans-Bold.ttf",
    "LiberationSans-Italic.ttf",
    "LiberationSans-BoldItalic.ttf",
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = (targetUrl) => {
            https.get(targetUrl, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    request(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
                    return;
                }
                res.pipe(file);
                file.on("finish", () => file.close(resolve));
            }).on("error", reject);
        };
        request(url);
    });
}

async function main() {
    const alreadyPresent = FONTS_TO_EXTRACT.every((f) =>
        fs.existsSync(path.join(FONTS_DIR, f))
    );
    if (alreadyPresent) {
        console.log("Liberation fonts already present, skipping download.");
        return;
    }

    console.log(`Downloading Liberation fonts ${VERSION}...`);
    await download(ARCHIVE_URL, ARCHIVE_PATH);

    console.log("Extracting fonts...");
    execSync(
        `tar -xzf "${ARCHIVE_PATH}" --strip-components=1 -C "${FONTS_DIR}" ${FONTS_TO_EXTRACT.map(
            (f) => `liberation-fonts-ttf-${VERSION}/${f}`
        ).join(" ")}`
    );

    fs.unlinkSync(ARCHIVE_PATH);
    console.log("Done. Fonts available in fonts/");
}

main().catch((err) => {
    console.error("Failed to download fonts:", err.message);
    process.exit(1);
});
