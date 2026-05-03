import { fixSlashes } from "@shared/Util";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import * as path from "path";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Footer } from "../components/Footer";
import { withPreferences, WithPreferencesProps } from "./withPreferences";
import { RootState } from "../redux/store";
import { playMusic, stopMusic } from "../redux/searchSlice";

type OwnProps = WithPreferencesProps & {
    libraryPath: string;
    totalCount?: number;
    currentLabel?: string;
    scaleSliderValue: number;
    onScaleSliderChange?: (value: number) => void;
    layout: BrowsePageLayout;
    onLayoutChange?: (value: BrowsePageLayout) => void;
};

function FooterContainer(props: OwnProps) {
    const dispatch = useDispatch();
    const view = useSelector((state: RootState) => state.searchState.views[props.libraryPath]);
    const isMusicPlaying = useSelector((state: RootState) => state.searchState.isMusicPlaying);
    const musicPath = view?.selectedGame?.musicPath;

    return (
        <Footer
            {...props}
            currentCount={view?.games.length ?? 0}
            hasMusicPath={!!musicPath}
            isMusicPlaying={isMusicPlaying}
            onPlayMusic={() => {
                if (musicPath) {
                    dispatch(playMusic(path.join(window.External.config.fullExodosPath, fixSlashes(musicPath))));
                }
            }}
            onStopMusic={() => dispatch(stopMusic())}
        />
    );
}

export const ConnectedFooter = withPreferences(FooterContainer);
