import { faArrowsRotate, faBars, faCog } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ExodosResources } from "@renderer/util/exoResources";
import { BackIn } from "@shared/back/types";
import { getLibraryItemTitle } from "@shared/library/util";
import { throttle } from "@shared/utils/throttle";
import { MenuItemConstructorOptions } from "electron";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
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
            label: "Advanced",
            type: "submenu",
            submenu: [
                {
                    label: "Logs",
                    click() {
                        navigate(Paths.LOGS);
                    },
                },
                {
                    label: "Developer",
                    click() {
                        navigate(Paths.DEVELOPER);
                    },
                },
            ],
        },
        {
            label: "Config",
            click() {
                navigate(Paths.CONFIG);
            },
        },
        {
            label: "About",
            click() {
                navigate(Paths.ABOUT);
            },
        },
        {
            type: "separator",
        },
        {
            label: "Quit",
            click() {
                window.External.back.send(BackIn.QUIT);
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
                </ul>
                <ul className="header__menu header__menu--right">
                    <UpdateIndicator />
                    <li className="header__menu__item">
                        <Link to={Paths.CONFIG} className="header__menu__item__link">
                            <FontAwesomeIcon icon={faCog} />
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
}

function UpdateIndicator() {
    const status = useSelector((state: RootState) => state.updateDialogState.status);

    if (status === "checking") {
        return (
            <li className="header__menu__item">
                <span className="header__menu__item__link header__update-checking" title="Checking for updates...">
                    <FontAwesomeIcon icon={faArrowsRotate} className="header__update-spin" />
                </span>
            </li>
        );
    }

    if (status === "available" || status === "downloaded") {
        return (
            <li className="header__menu__item">
                <span className="header__menu__item__link header__update-dot-wrapper" title="Update available">
                    <span className="header__update-dot" />
                </span>
            </li>
        );
    }

    return null;
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
