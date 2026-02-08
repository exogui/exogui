import * as React from "react";

export type AboutPageProps = Record<string, never>;

const discordlink = "https://discord.gg/WY25CAgz";
const exoguiRepoLink = "https://github.com/exogui/exogui";
const exoProjectsLink = "https://www.retro-exo.com";

const link = (title: string, url: string): React.JSX.Element => {
    return (
        <a href={url} title={url} target="_blank">
            {title}
        </a>
    );
};

export function AboutPage(_props: AboutPageProps) {
    const version = window.External.version;

    // Render
    return (
        <div className="about-page simple-scroll">
            <div className="about-page__content">
                <p className="about-page__header">exogui</p>
                <p>{`Version ${version}`}</p>
                {link(exoguiRepoLink, exoguiRepoLink)}
                <p>
                    exogui is the official Linux frontend for{" "}
                    {link("eXo projects", exoProjectsLink)}.
                </p>
                <br />
                <p>Thanks to eXo and his team for developing the projects.</p>
                <br />
                <p>
                    Want to help? Volunteer in the{" "}
                    {link("Discord", discordlink)}.
                </p>
            </div>
        </div>
    );
}
