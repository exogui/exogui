/** Channel to send the "intialize renderer" message over. */
export const InitRendererChannel = "renderer-init";

/** Message contents for the "initialze renderer" message. */
export type InitRendererData = {
    isBackRemote: boolean;
    installed: boolean;
    host: string;
    secret: string;
};

export const FlashInitChannel = "renderer-flash-init";

export type FlashInitData = {
    entry: string;
};
