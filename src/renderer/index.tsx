import { SocketClient } from "@shared/back/SocketClient";
import { BackIn } from "@shared/back/types";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import App from "./app";
import { ContextReducerProvider } from "./context-reducer/ContextReducerProvider";
import { PreferencesContextProvider } from "./context/PreferencesContext";
import { ProgressContext } from "./context/ProgressContext";
import store from "./redux/store";

function logFactory(socketServer: SocketClient<WebSocket>): LogFunc {
    return function (source: string, content: string) {
        socketServer.send(BackIn.ADD_LOG, {
            source: source,
            content: content
        });
        return {
            source: source,
            content: content,
            timestamp: Date.now(),
        };
    };
}

(async () => {
    const diagnosticsEnabled = (typeof process !== "undefined" && Array.isArray(process.argv))
        ? process.argv.includes("--exogui-diagnostics=true")
        : false;

    if (diagnosticsEnabled) {
        window.addEventListener("error", (event) => {
            console.error(
                `[Diagnostics][renderer] window.error: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
                event.error?.stack
            );
        });
        window.addEventListener("unhandledrejection", (event) => {
            const reason = event.reason;
            const detail =
                reason instanceof Error
                    ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}`
                    : typeof reason === "string"
                        ? reason
                        : (() => { try { return JSON.stringify(reason); } catch { return String(reason); } })();
            console.error(`[Diagnostics][renderer] unhandledrejection: ${detail}`);
        });
    }

    // Toggle DevTools when CTRL+SHIFT+I is pressed
    window.addEventListener("keypress", (event) => {
        if (event.ctrlKey && event.shiftKey && event.code === "KeyI") {
            window.External.toggleDevtools();
            event.preventDefault();
        }
    });

    await window.External.waitUntilInitialized();

    // Add global logging func
    window.log = logFactory(window.External.back);

    const root = ReactDOM.createRoot(
        document.getElementById("root") as HTMLElement
    );
    root.render(
        <Provider store={store}>
            <PreferencesContextProvider>
                <ContextReducerProvider context={ProgressContext}>
                    <HashRouter>
                        <App />
                    </HashRouter>
                </ContextReducerProvider>
            </PreferencesContextProvider>
        </Provider>
    );
})();

