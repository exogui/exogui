import * as React from "react";
import { ipcRenderer } from "electron";
import { UpdaterIPC } from "@shared/interfaces";

export function DeveloperPage() {
    const [downloadProgress, setDownloadProgress] = React.useState(0);
    const [isDownloading, setIsDownloading] = React.useState(false);

    const testUpdateAvailable = () => {
        ipcRenderer.send(UpdaterIPC.TEST_UPDATE_AVAILABLE, {
            version: "1.3.0",
            currentVersion: "1.2.4",
            releaseName: "Feature Update - Online Updater",
            releaseNotes: `# What's New in v1.3.0

## New Features
- **React-based Update Dialog**: Beautiful modal dialogs replace native notifications
- **Download Progress**: Real-time progress bar with speed and size information
- **Keyboard Navigation**: Full keyboard support (Tab, ESC, Enter)

## Improvements
- Better error handling and user feedback
- Smoother animations and transitions
- Theme-integrated styling

## Bug Fixes
- Fixed crash on startup in dev mode
- Improved error messages`,
            size: 125829120,
        });
    };

    const testDownloadProgress = () => {
        setIsDownloading(true);
        setDownloadProgress(0);

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                const next = prev + 2;
                if (next >= 100) {
                    clearInterval(interval);
                    setIsDownloading(false);
                    return 100;
                }

                const transferred = (next / 100) * 125829120;
                const total = 125829120;
                const bytesPerSecond = 2500000 + Math.random() * 1000000;

                ipcRenderer.send(UpdaterIPC.TEST_DOWNLOAD_PROGRESS, {
                    percent: next,
                    transferred: transferred,
                    total: total,
                    bytesPerSecond: bytesPerSecond,
                });

                return next;
            });
        }, 200);
    };

    const testUpdateDownloaded = () => {
        ipcRenderer.send(UpdaterIPC.TEST_DOWNLOADED, {
            version: "1.3.0",
            releaseName: "Feature Update - Online Updater",
        });
    };

    const testUpdateError = () => {
        ipcRenderer.send(UpdaterIPC.TEST_ERROR, {
            message: "Failed to download update",
            details: `Error: ECONNREFUSED: Connection refused
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1148:16)
    at Protocol._enqueue (/node_modules/protocol/index.js:212:15)
    at Protocol.get (/node_modules/protocol/index.js:189:10)
    at new ClientRequest (http.js:2452:16)
    at Object.request (https.js:312:10)`,
        });
    };

    const testCancelUpdate = () => {
        setIsDownloading(false);
        setDownloadProgress(0);
        ipcRenderer.send(UpdaterIPC.TEST_CANCELLED);
    };

    const testFullFlow = async () => {
        testUpdateAvailable();

        await new Promise(resolve => setTimeout(resolve, 3000));

        setIsDownloading(true);
        setDownloadProgress(0);

        for (let i = 0; i <= 100; i += 5) {
            const transferred = (i / 100) * 125829120;
            const total = 125829120;
            const bytesPerSecond = 2500000 + Math.random() * 1000000;

            ipcRenderer.send(UpdaterIPC.TEST_DOWNLOAD_PROGRESS, {
                percent: i,
                transferred: transferred,
                total: total,
                bytesPerSecond: bytesPerSecond,
            });

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        setIsDownloading(false);

        await new Promise(resolve => setTimeout(resolve, 500));

        testUpdateDownloaded();
    };

    return (
        <div className="developer-page">
            <div className="developer-page__header">
                <h1>Developer Tools</h1>
                <p>Testing utilities for development and debugging</p>
            </div>

            <div className="developer-page__section">
                <h2>Update Dialog Tester</h2>
                <p className="developer-page__description">
                    Test the online updater dialog with mock data. This simulates the complete update flow
                    without requiring actual GitHub releases.
                </p>

                <div className="developer-page__button-group">
                    <button
                        className="developer-page__button developer-page__button--primary"
                        onClick={testUpdateAvailable}
                        disabled={isDownloading}
                    >
                        Show Update Available
                    </button>

                    <button
                        className="developer-page__button developer-page__button--primary"
                        onClick={testDownloadProgress}
                        disabled={isDownloading}
                    >
                        Simulate Download Progress
                    </button>

                    <button
                        className="developer-page__button developer-page__button--primary"
                        onClick={testUpdateDownloaded}
                        disabled={isDownloading}
                    >
                        Show Update Downloaded
                    </button>

                    <button
                        className="developer-page__button developer-page__button--danger"
                        onClick={testUpdateError}
                        disabled={isDownloading}
                    >
                        Show Update Error
                    </button>

                    <button
                        className="developer-page__button developer-page__button--secondary"
                        onClick={testCancelUpdate}
                        disabled={!isDownloading}
                    >
                        Cancel/Hide Dialog
                    </button>
                </div>

                <div className="developer-page__button-group">
                    <button
                        className="developer-page__button developer-page__button--success"
                        onClick={testFullFlow}
                        disabled={isDownloading}
                    >
                        Test Full Update Flow (Auto)
                    </button>
                </div>

                {isDownloading && (
                    <div className="developer-page__status">
                        <div className="developer-page__status-text">
                            Simulating download: {downloadProgress}%
                        </div>
                        <div className="developer-page__status-bar">
                            <div
                                className="developer-page__status-fill"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="developer-page__section">
                <h2>Instructions</h2>
                <ul className="developer-page__instructions">
                    <li><strong>Show Update Available:</strong> Displays the initial update notification with version info and changelog</li>
                    <li><strong>Simulate Download Progress:</strong> Shows animated progress bar (0-100% over 20 seconds)</li>
                    <li><strong>Show Update Downloaded:</strong> Displays success state with restart options</li>
                    <li><strong>Show Update Error:</strong> Displays error state with expandable details</li>
                    <li><strong>Cancel/Hide Dialog:</strong> Hides the current dialog</li>
                    <li><strong>Test Full Update Flow:</strong> Automatically runs through: Available → Downloading → Downloaded</li>
                </ul>
                <div className="developer-page__note">
                    <strong>Note:</strong> Test mode only simulates the UI dialogs. The "Download and Install" and "Restart Now"
                    buttons won't trigger actual downloads or restarts. To test the full updater functionality, you need to
                    publish a real GitHub release and run the app as a packaged AppImage.
                </div>
            </div>

            <div className="developer-page__section">
                <h2>Keyboard Testing</h2>
                <ul className="developer-page__instructions">
                    <li><strong>Tab:</strong> Navigate between buttons</li>
                    <li><strong>Enter:</strong> Activate focused button</li>
                    <li><strong>ESC:</strong> Cancel/dismiss dialog (context-dependent)</li>
                    <li><strong>Click outside:</strong> Cancel dialog (in available/error states)</li>
                </ul>
            </div>
        </div>
    );
}
