import * as React from "react";
import { BackIn } from "@shared/back/types";
import {
    UpdateAvailableData,
    UpdateDownloadedData,
    UpdateDownloadProgressData,
    UpdateErrorData,
} from "@shared/back/types";

export type UpdateDialogProps = {
    status: "hidden" | "available" | "downloading" | "downloaded" | "error";
    updateInfo?: UpdateAvailableData;
    downloadProgress?: UpdateDownloadProgressData;
    downloadedInfo?: UpdateDownloadedData;
    error?: UpdateErrorData;
    hideDialog: () => void;
};

export function UpdateDialog(props: UpdateDialogProps) {
    const { status, updateInfo, downloadProgress, downloadedInfo, error, hideDialog } = props;
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const firstFocusableRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (status !== "hidden") {
            firstFocusableRef.current?.focus();
        }
    }, [status]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            if (status === "available") {
                handleSkip();
            } else if (status === "downloading") {
                hideDialog();
            } else if (status === "error") {
                handleDismissError();
            }
        }
    };

    const handleOverlayClick = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            if (status === "available") {
                handleSkip();
            } else if (status === "downloading") {
                hideDialog();
            } else if (status === "error") {
                handleDismissError();
            }
        }
    };

    const handleStartDownload = () => {
        window.External.back.send(BackIn.UPDATE_START_DOWNLOAD);
    };

    const handleSkip = () => {
        window.External.back.send(BackIn.UPDATE_SKIP);
    };

    const handleInstallNow = () => {
        window.External.back.send(BackIn.UPDATE_INSTALL_NOW);
    };

    const handleDismissError = () => {
        window.External.back.send(BackIn.UPDATE_DISMISS_ERROR);
    };

    if (status === "hidden") {
        return null;
    }

    return (
        <div
            className="update-dialog-overlay"
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
        >
            <div
                className="update-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
            >
                {status === "available" && updateInfo && (
                    <AvailableState
                        data={updateInfo}
                        onDownload={handleStartDownload}
                        onSkip={handleSkip}
                        firstFocusableRef={firstFocusableRef}
                    />
                )}
                {status === "downloading" && downloadProgress && (
                    <DownloadingState
                        data={downloadProgress}
                        onHide={hideDialog}
                        firstFocusableRef={firstFocusableRef}
                    />
                )}
                {status === "downloaded" && downloadedInfo && (
                    <DownloadedState
                        data={downloadedInfo}
                        onInstallNow={handleInstallNow}
                        onLater={handleSkip}
                        firstFocusableRef={firstFocusableRef}
                    />
                )}
                {status === "error" && error && (
                    <ErrorState
                        data={error}
                        onDismiss={handleDismissError}
                        firstFocusableRef={firstFocusableRef}
                    />
                )}
            </div>
        </div>
    );
}

type AvailableStateProps = {
    data: UpdateAvailableData;
    onDownload: () => void;
    onSkip: () => void;
    firstFocusableRef: React.RefObject<HTMLButtonElement>;
};

function AvailableState(props: AvailableStateProps) {
    const { data, onDownload, onSkip, firstFocusableRef } = props;

    const formatReleaseNotes = (notes: string): string => {
        if (!notes) return "No release notes available.";
        return notes;
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <>
            <div className="update-dialog__header">
                <h2 className="update-dialog__title">Update Available</h2>
            </div>
            <div className="update-dialog__content">
                <div className="update-dialog__version-info">
                    <div className="update-dialog__version-row">
                        <span className="update-dialog__version-label">Current Version:</span>
                        <span className="update-dialog__version-value">{data.currentVersion}</span>
                    </div>
                    <div className="update-dialog__version-row">
                        <span className="update-dialog__version-label">New Version:</span>
                        <span className="update-dialog__version-value update-dialog__version-value--new">
                            {data.version}
                        </span>
                    </div>
                    <div className="update-dialog__version-row">
                        <span className="update-dialog__version-label">Download Size:</span>
                        <span className="update-dialog__version-value">{formatBytes(data.size)}</span>
                    </div>
                </div>
                <div className="update-dialog__release-notes">
                    <h3 className="update-dialog__release-notes-title">What's New</h3>
                    <div className="update-dialog__release-notes-content">
                        {formatReleaseNotes(data.releaseNotes)}
                    </div>
                </div>
            </div>
            <div className="update-dialog__actions">
                <button
                    ref={firstFocusableRef}
                    className="update-dialog__button update-dialog__button--primary"
                    onClick={onDownload}
                >
                    Download and Install
                </button>
                <button
                    className="update-dialog__button update-dialog__button--secondary"
                    onClick={onSkip}
                >
                    Skip This Update
                </button>
            </div>
        </>
    );
}

type DownloadingStateProps = {
    data: UpdateDownloadProgressData;
    onHide: () => void;
    firstFocusableRef: React.RefObject<HTMLButtonElement>;
};

function DownloadingState(props: DownloadingStateProps) {
    const { data, onHide, firstFocusableRef } = props;

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        return formatBytes(bytesPerSecond) + "/s";
    };

    return (
        <>
            <div className="update-dialog__header">
                <h2 className="update-dialog__title">Downloading Update</h2>
            </div>
            <div className="update-dialog__content">
                <div className="update-dialog__progress-info">
                    <div className="update-dialog__progress-percent">
                        {Math.round(data.percent)}%
                    </div>
                    <div className="update-dialog__progress-bar">
                        <div
                            className="update-dialog__progress-fill"
                            style={{ width: `${data.percent}%` }}
                        />
                    </div>
                    <div className="update-dialog__progress-details">
                        <span className="update-dialog__progress-size">
                            {formatBytes(data.transferred)} / {formatBytes(data.total)}
                        </span>
                        <span className="update-dialog__progress-speed">
                            {formatSpeed(data.bytesPerSecond)}
                        </span>
                    </div>
                </div>
                <div className="update-dialog__note">
                    Download will continue in the background if you hide this dialog.
                </div>
            </div>
            <div className="update-dialog__actions">
                <button
                    ref={firstFocusableRef}
                    className="update-dialog__button update-dialog__button--secondary"
                    onClick={onHide}
                >
                    Hide
                </button>
            </div>
        </>
    );
}

type DownloadedStateProps = {
    data: UpdateDownloadedData;
    onInstallNow: () => void;
    onLater: () => void;
    firstFocusableRef: React.RefObject<HTMLButtonElement>;
};

function DownloadedState(props: DownloadedStateProps) {
    const { data, onInstallNow, onLater, firstFocusableRef } = props;

    return (
        <>
            <div className="update-dialog__header update-dialog__header--success">
                <h2 className="update-dialog__title">Update Ready</h2>
            </div>
            <div className="update-dialog__content">
                <div className="update-dialog__success-message">
                    <div className="update-dialog__success-icon">✓</div>
                    <p className="update-dialog__success-text">
                        Version {data.version} has been downloaded and is ready to install.
                    </p>
                    <p className="update-dialog__success-subtext">
                        The application will restart to complete the installation.
                    </p>
                </div>
            </div>
            <div className="update-dialog__actions">
                <button
                    ref={firstFocusableRef}
                    className="update-dialog__button update-dialog__button--primary"
                    onClick={onInstallNow}
                >
                    Restart Now
                </button>
                <button
                    className="update-dialog__button update-dialog__button--secondary"
                    onClick={onLater}
                >
                    Later
                </button>
            </div>
        </>
    );
}

type ErrorStateProps = {
    data: UpdateErrorData;
    onDismiss: () => void;
    firstFocusableRef: React.RefObject<HTMLButtonElement>;
};

function ErrorState(props: ErrorStateProps) {
    const { data, onDismiss, firstFocusableRef } = props;
    const [showDetails, setShowDetails] = React.useState(false);

    return (
        <>
            <div className="update-dialog__header update-dialog__header--error">
                <h2 className="update-dialog__title">Update Error</h2>
            </div>
            <div className="update-dialog__content">
                <div className="update-dialog__error-message">
                    <div className="update-dialog__error-icon">✕</div>
                    <p className="update-dialog__error-text">{data.message}</p>
                    {data.details && (
                        <>
                            <button
                                className="update-dialog__details-toggle"
                                onClick={() => setShowDetails(!showDetails)}
                            >
                                {showDetails ? "Hide Details" : "Show Details"}
                            </button>
                            {showDetails && (
                                <div className="update-dialog__error-details">
                                    {data.details}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className="update-dialog__actions">
                <button
                    ref={firstFocusableRef}
                    className="update-dialog__button update-dialog__button--primary"
                    onClick={onDismiss}
                >
                    OK
                </button>
            </div>
        </>
    );
}
