/** Channel to send the "intialize renderer" message over. */
export const InitRendererChannel = "renderer-init";

/** Message contents for the "initialze renderer" message. */
export type InitRendererData = {
    isBackRemote: boolean;
    installed: boolean;
    host: string;
    secret: string;
    onlineUpdateSupported?: boolean;
};

/** Runtime capabilities detected at startup (read-only, not persisted to config). */
export type RuntimeCapabilities = {
    /** Whether online updates are supported on this platform/build. */
    onlineUpdateSupported: boolean;
};

export const FlashInitChannel = "renderer-flash-init";

export type FlashInitData = {
    entry: string;
};
