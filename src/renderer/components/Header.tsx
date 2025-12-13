import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { englishTranslation } from "@renderer/lang/en";
import { ExodosResources } from "@renderer/util/exoResources";
import { BackIn } from "@shared/back/types";
import { getLibraryItemTitle } from "@shared/library/util";
import { throttle } from "@shared/utils/throttle";
import { MenuItemConstructorOptions } from "electron";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Paths } from "../Paths";
import { joinLibraryRoute, openContextMenu } from "../Util";
import { WithPreferencesProps } from "../containers/withPreferences";

type OwnProps = {
    exodosResources: ExodosResources;
    /** Array of library routes */
    libraries: string[];
};

export type HeaderProps = OwnProps & WithPreferencesProps;

export function Header(props: HeaderProps) {
    const strings = englishTranslation.app;
    const { exodosResources, libraries } = props;

    const navigate = useNavigate();

    const librariesScriptsMenu: MenuItemConstructorOptions[] = Object.entries(
        exodosResources
    ).map((er) => {
        const [label, resources] = er;
        return {
            label,
            type: "submenu",
            submenu: resources.map((r) =>
                r === null
                    ? {
                        type: "separator",
                    }
                    : {
                        label: r.label,
                        click() {
                            onLaunchCommand(r.filepath);
                        },
                    }
            ),
        };
    });
    const menuButtons: MenuItemConstructorOptions[] = [
        ...librariesScriptsMenu,
        {
            type: "separator",
        },
        {
            label: "About",
            click() {
                navigate(Paths.ABOUT);
            },
        },
    ];

    return (
        <div className="header">
            {/* Header Menu */}
            <div className="header__wrap">
                <ul className="header__menu">
                    <li className="header__menu__item">
                        <a
                            className="header__menu__item__link"
                            onClick={() => openContextMenu(menuButtons)}
                        >
                            <FontAwesomeIcon icon={faBars} />
                        </a>
                    </li>
                    {libraries.map((library) => (
                        <MenuItem
                            key={library}
                            title={getLibraryItemTitle(library)}
                            link={joinLibraryRoute(library)}
                        />
                    ))}
                    <MenuItem title={strings.logs} link={Paths.LOGS} />
                    <MenuItem title={strings.config} link={Paths.CONFIG} />
                </ul>
            </div>
        </div>
    );
}

/** An item in the header menu. Used as buttons to switch between tabs/pages. */
function MenuItem({ title, link }: { title: string; link: string }) {
    return (
        <li className="header__menu__item">
            <Link to={link} className="header__menu__item__link">
                {title}
            </Link>
        </li>
    );
}

export const onLaunchCommand = throttle((path: string): void => {
    window.External.back.send(BackIn.LAUNCH_COMMAND, path);
}, 500);
