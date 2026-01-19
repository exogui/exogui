import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
    UpdateAvailableData,
    UpdateDownloadedData,
    UpdateDownloadProgressData,
    UpdateErrorData,
} from "@shared/back/types";

export type UpdateDialogStatus = "hidden" | "available" | "downloading" | "downloaded" | "error";

type UpdateDialogState = {
    status: UpdateDialogStatus;
    updateInfo?: UpdateAvailableData;
    downloadProgress?: UpdateDownloadProgressData;
    downloadedInfo?: UpdateDownloadedData;
    error?: UpdateErrorData;
};

const initialState: UpdateDialogState = {
    status: "hidden",
};

const updateDialogSlice = createSlice({
    name: "updateDialog",
    initialState,
    reducers: {
        showUpdateAvailable(
            state: UpdateDialogState,
            { payload }: PayloadAction<UpdateAvailableData>
        ) {
            state.status = "available";
            state.updateInfo = payload;
            state.downloadProgress = undefined;
            state.downloadedInfo = undefined;
            state.error = undefined;
        },
        showDownloading(
            state: UpdateDialogState,
            { payload }: PayloadAction<UpdateDownloadProgressData>
        ) {
            state.status = "downloading";
            state.downloadProgress = payload;
            state.error = undefined;
        },
        showDownloaded(
            state: UpdateDialogState,
            { payload }: PayloadAction<UpdateDownloadedData>
        ) {
            state.status = "downloaded";
            state.downloadedInfo = payload;
            state.downloadProgress = undefined;
            state.error = undefined;
        },
        showError(
            state: UpdateDialogState,
            { payload }: PayloadAction<UpdateErrorData>
        ) {
            state.status = "error";
            state.error = payload;
            state.downloadProgress = undefined;
        },
        hideDialog(state: UpdateDialogState) {
            state.status = "hidden";
            state.updateInfo = undefined;
            state.downloadProgress = undefined;
            state.downloadedInfo = undefined;
            state.error = undefined;
        },
    },
});

export const {
    showUpdateAvailable,
    showDownloading,
    showDownloaded,
    showError,
    hideDialog,
} = updateDialogSlice.actions;
export default updateDialogSlice.reducer;
