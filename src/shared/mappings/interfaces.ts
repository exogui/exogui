export type ICommandMapping = {
    extensions: string[];
    command: string;
    includeFilename: boolean;
    includeArgs: boolean;
    setCwdToFileDir?: boolean;
};

export type IAppCommandsMappingData = {
    defaultMapping: ICommandMapping;
    commandsMapping: ICommandMapping[];
};

export const EmptyCommandMapping: ICommandMapping = {
    command: "",
    extensions: [],
    includeArgs: true,
    includeFilename: true,
};
