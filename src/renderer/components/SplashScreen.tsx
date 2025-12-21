import { englishTranslation } from "@renderer/lang/en";
import { LoadingState } from "@renderer/redux/loadingSlice";
import * as React from "react";

export type SplashScreenProps = {
    loadingState: LoadingState;
    onGoToConfig?: () => void;
};

export function SplashScreen(props: SplashScreenProps) {
    const { loadingState, onGoToConfig } = props;
    const strings = englishTranslation.splash;
    const [dismissed, setDismissed] = React.useState(false);

    const {
        platformsLoaded,
        playlistsLoaded,
        execLoaded,
        platformLoadingProgress,
        errorMessage,
    } = loadingState;

    const allLoaded = platformsLoaded && playlistsLoaded && execLoaded;
    const shouldFadeOut = allLoaded || dismissed;
    const extraClass = shouldFadeOut ? " splash-screen--fade-out" : "";

    const progressPercent = allLoaded
        ? 100
        : platformLoadingProgress
            ? Math.round((platformLoadingProgress.currentIndex / platformLoadingProgress.total) * 95)
            : 0;

    const logoStyle: React.CSSProperties = {
        filter: `grayscale(${100 - progressPercent}%)`,
        transition: "filter 0.4s ease-in",
    };

    const handleGoToConfig = () => {
        setDismissed(true);
        onGoToConfig?.();
    };

    const renderStatusItem = (loaded: boolean, label: string, detail?: string) => {
        const iconClass = loaded
            ? "splash-screen__status-icon splash-screen__status-icon--done"
            : "splash-screen__status-icon splash-screen__status-icon--loading";
        return (
            <div className="splash-screen__status-item">
                <span className={iconClass}>
                    {loaded ? "✓" : "⟳"}
                </span>
                <span className="splash-screen__status-label">
                    {label}
                    {detail && !loaded && (
                        <span className="splash-screen__status-detail"> ({detail})</span>
                    )}
                </span>
            </div>
        );
    };

    const platformDetail = platformLoadingProgress
        ? `${platformLoadingProgress.currentName} - ${platformLoadingProgress.currentIndex}/${platformLoadingProgress.total}`
        : undefined;

    return (
        <div className={"splash-screen" + extraClass}>
            <div className="splash-screen__logo" style={logoStyle} />
            <div className="splash-screen__status-block">
                {errorMessage ? (
                    <>
                        <div className="splash-screen__status-header splash-screen__status-header--error">
                            {strings.errorLoading}
                        </div>
                        <div className="splash-screen__status splash-screen__status--error">
                            {errorMessage || strings.unknownError}
                        </div>
                        <div className="splash-screen__hint">
                            {strings.configHint}
                        </div>
                        <button
                            className="splash-screen__button"
                            onClick={handleGoToConfig}
                        >
                            {strings.goToConfig}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="splash-screen__progress-bar">
                            <div
                                className="splash-screen__progress-fill"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="splash-screen__status-list">
                            {renderStatusItem(platformsLoaded, strings.games, platformDetail)}
                            {renderStatusItem(playlistsLoaded, strings.playlists)}
                            {renderStatusItem(execLoaded, strings.misc)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
