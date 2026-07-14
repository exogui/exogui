const fs = require("fs-extra");
const gulp = require("gulp");
const builder = require("electron-builder");
const { Platform, Arch, archFromString } = require("electron-builder");
const { exec } = require("child_process");
const { createRsbuild, loadConfig } = require('@rsbuild/core');

const packageJson = JSON.parse(fs.readFileSync("./package.json"));
const config = {
    buildVersion: Date.now().toString(),
    isRelease: process.env.NODE_ENV === "production",
    isStaticInstall: packageJson.config.installed,
    static: {
        src: "./static",
        dest: "./build",
    },
    main: {
        src: "./src/main",
    },
    sevenZip: "./extern/7zip-bin",
    back: {
        src: "./src/back",
    },
};

/* ------ Watch ------ */

gulp.task("build-back-dev", (done) => {
    execute("npx swc --strip-leading-paths --no-swcrc --config-file swcrc.back.dev.json --source-maps true -d build src", done);
});

gulp.task("watch-back", (done) => {
    gulp.watch("src/**/*.{ts,tsx}", gulp.task("build-back-dev"));
    done();
});

gulp.task("watch-renderer", async (done) => {
    const config = await loadConfig();
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        ...config.content
      }
    });
    await rsbuild.build({
      watch: true
    });
    done();
});

gulp.task("watch-static", () => {
    gulp.watch(config.static.src + "/**/*", gulp.task("copy-static"));
});

/* ------ Build ------ */

gulp.task("build-back", (done) => {
    execute("npx swc --strip-leading-paths --no-swcrc --config-file swcrc.back.prod.json -d build src", done);
});

gulp.task("build-renderer", async (done) => {
    const config = await loadConfig();
    const rsbuild = await createRsbuild({
        rsbuildConfig: config.content
    });
    await rsbuild.build();
    done();
});

gulp.task("copy-static", () => {
    return gulp
        .src(config.static.src + "/**/*", { encoding: false })
        .pipe(gulp.dest(config.static.dest));
});

/* ------ Pack ------ */

gulp.task("pack", (done) => {
    const targets = createBuildTargets(
        process.env.PACK_PLATFORM,
        process.env.PACK_ARCH,
    );
    const copyFiles = getCopyFiles();
    const isLegacy = process.env.PACK_LEGACY === "true";
    const productName = isLegacy ? "exogui-legacy" : "exogui";
    const appId = isLegacy ? "com.exo.exogui.legacy" : "com.exo.exogui";
    builder
        .build({
            publish: process.env.PUBLISH ? "always" : "never",
            config: {
                appId,
                productName,
                directories: {
                    buildResources: "./static/",
                    output: "./dist/",
                },
                files: ["./build"],
                extraFiles: copyFiles, // Files to copy to the build folder
                compression: "store", // Only used if a compressed target (like 7z, nsis, dmg etc)
                asar: true,
                // sharp/libvips native binaries (.node + libvips .so/.dylib) must
                // live on disk so dlopen can resolve them — they cannot be loaded
                // from inside the asar archive.
                asarUnpack: [
                    "**/node_modules/sharp/**",
                    "**/node_modules/@img/**",
                ],
                generateUpdatesFilesForAllChannels: true,
                publish: createPublishInfo(),
                toolsets: {
                    appimage: "1.0.2",
                },
                linux: {
                    publish: "github",
                    target: ["AppImage", "tar.gz", "dir"],
                    category: "Game",
                    icon: "./static/icons/",
                    executableArgs: ["--no-sandbox"],
                    artifactName: "${productName}.${arch}.${ext}",
                },
                appImage: {
                    artifactName: "${productName}.${arch}.${ext}",
                },
                win: {
                    icon: "./icons/icon.ico",
                    target: ["nsis", "zip"],
                },
                nsis: {
                    oneClick: false,
                    allowToChangeInstallationDirectory: false,
                    perMachine: false,
                    deleteAppDataOnUninstall: false,
                    include: "./installer/win/exo-installer.nsh",
                },
                mac: {
                    icon: "./icons/icon.icns",
                    // These native binaries are byte identical across the x64
                    // and arm64 builds, so @electron/universal would fail the
                    // merge without an explicit allowance:
                    //  - @img: both arch builds ship the full set of sharp/
                    //    libvips binaries; sharp picks the right one at runtime.
                    //  - 7zip-bin: a single (non-fat) 7za binary shared by both.
                    x64ArchFiles: "**/{node_modules/@img,extern/7zip-bin}/**",
                },
            },
            targets: targets,
        })
        .then(() => {
            console.log("Pack - Done!");
            done();
        })
        .catch((error) => {
            console.log("Pack - Error!", error);
            done(error);
        });
});

/* ------ Meta Tasks ------*/

gulp.task(
    "watch",
    gulp.parallel(
        "watch-back",
        "watch-renderer",
        "watch-static",
        "copy-static",
    ),
);

gulp.task(
    "build",
    gulp.parallel(
        "build-back",
        "build-renderer",
        "copy-static",
    ),
);

/* ------ Misc ------*/

function execute(command, callback) {
    const child = exec(command);
    child.stderr.on("data", (data) => {
        console.log(data);
    });
    child.stdout.on("data", (data) => {
        console.log(data);
    });
    if (callback) {
        child.once("exit", () => {
            callback();
        });
    }
}

function createBuildTargets(os, arch) {
    switch (os) {
        case "win32":
            return Platform.WINDOWS.createTarget(
                ["nsis", "zip"],
                archFromString(arch),
            );
        case "darwin":
            return Platform.MAC.createTarget(["dmg"], archFromString(arch));
        case "linux": {
            // Build the requested arch only (each is built on a native runner so
            // its arch-specific sharp/libvips binaries get installed correctly).
            const linuxArch = archFromString(arch);
            const targets =
                linuxArch === Arch.x64
                    ? ["AppImage", "tar.gz", "dir"]
                    : ["AppImage", "tar.gz"];
            return Platform.LINUX.createTarget(targets, linuxArch);
        }
    }
}

function getCopyFiles() {
    const files = [
        {
            // Only copy 7zip execs for packed platform
            from: "./extern/7zip-bin",
            to: "./extern/7zip-bin",
            filter: ["${os}/**/*"],
        },
        "./lang",
        "./licenses",
        "./mappings.linux.json",
        "./mappings.win32.json",
        "./mappings.darwin.json",
        "./platform_options.json",
        {
            from: "./LICENSE",
            to: "./licenses/LICENSE",
        },
    ];
    if (process.env.PACK_PLATFORM === "linux" && fs.existsSync("./fonts")) {
        files.push({ from: "./fonts", to: "./fonts" });
    }
    return files;
}

function createPublishInfo() {
    return [
        {
            provider: "github",
            owner: "exogui",
            repo: "exogui",
        },
    ];
}
