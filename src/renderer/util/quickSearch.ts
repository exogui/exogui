import { IGameInfo } from "@shared/game/interfaces";

export function binarySearchGame(games: IGameInfo[], query: string): IGameInfo | undefined {
    const q = query.toLowerCase();
    let lo = 0;
    let hi = games.length - 1;
    let result: IGameInfo | undefined;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (games[mid].orderTitle >= q) {
            result = games[mid];
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }
    return result;
}

export function linearSearchGame(games: IGameInfo[], query: string): IGameInfo | undefined {
    const q = query.toLowerCase();
    let best: IGameInfo | undefined;
    for (const g of games) {
        if (g.orderTitle.startsWith(q) && (!best || g.orderTitle < best.orderTitle)) {
            best = g;
        }
    }
    return best;
}
