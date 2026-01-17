import * as React from "react";
import { GameGrid, GameGridProps } from "./GameGrid";

export type GameGridWithWrappingProps = GameGridProps & {
    /** Enable wrapping behavior (default: true) */
    enableWrapping?: boolean;
};

/**
 * Wrapper component for GameGrid that adds column wrapping behavior.
 * When at the last column, pressing right arrow wraps to the first column of the next row.
 * When at the first column, pressing left arrow wraps to the last column of the previous row.
 */
export class GameGridWithWrapping extends React.Component<GameGridWithWrappingProps> {
    /** Reference to the underlying GameGrid element */
    gridRef: HTMLDivElement | null = null;
    /** Cached column count from last render */
    cachedColumns: number = 0;

    render() {
        const { enableWrapping = true, ...gameGridProps } = this.props;

        return (
            <div
                onKeyDown={enableWrapping ? this.onKeyDown : undefined}
                style={{ width: "100%", height: "100%" }}
            >
                <GameGrid
                    {...gameGridProps}
                    gridRef={this.setGridRef}
                />
            </div>
        );
    }

    /** Callback to get reference to GameGrid's grid element */
    setGridRef = (ref: HTMLDivElement | null): void => {
        this.gridRef = ref;

        // Extract and cache column count from grid
        if (ref) {
            this.cachedColumns = this.extractColumnCount(ref);
        }

        // Pass through to parent's gridRef if provided
        if (this.props.gridRef) {
            this.props.gridRef(ref);
        }
    };

    /** Extract column count from the grid element's computed dimensions */
    extractColumnCount(gridElement: HTMLDivElement): number {
        // Get first row element to count columns
        const firstRow = gridElement.querySelector("[aria-rowindex=\"1\"]");
        if (firstRow) {
            // Count cells in first row
            const cells = firstRow.querySelectorAll("[role=\"gridcell\"]");
            return cells.length;
        }

        // Fallback: calculate from grid width and cell width
        const cellWidth = this.props.cellWidth || 1;
        const gridWidth = gridElement.clientWidth - 16; // Subtract scrollbar
        return Math.max(1, Math.floor(gridWidth / cellWidth));
    }

    /** Get current position (column, row) from selected game */
    getCurrentPosition(): { column: number; row: number } | null {
        const { selectedGame, games } = this.props;

        if (!selectedGame || !games) {
            return null;
        }

        // Find index of selected game
        const index = games.findIndex(g => g.id === selectedGame.id);
        if (index < 0) {
            return null;
        }

        const columns = this.cachedColumns || 1;
        return {
            column: index % columns,
            row: Math.floor(index / columns)
        };
    }

    /** Calculate wrapped position when navigating with arrow keys */
    calculateWrappedPosition(
        key: string,
        currentColumn: number,
        currentRow: number
    ): { column: number; row: number } | null {
        const { games, gamesTotal } = this.props;
        const columns = this.cachedColumns || 1;
        const rows = Math.ceil(gamesTotal / columns);

        if (!games || gamesTotal === 0 || columns === 0) {
            return null;
        }

        // Right arrow at last column
        if (key === "ArrowRight" && currentColumn === columns - 1) {
            const currentIndex = currentRow * columns + currentColumn;

            // Only wrap if there's a game at current position
            if (currentIndex < gamesTotal && games[currentIndex]) {
                const nextRow = currentRow + 1;

                // Don't wrap past last row
                if (nextRow >= rows) {
                    return null;
                }

                const nextIndex = nextRow * columns;

                // Ensure there's a game at target position
                if (nextIndex < gamesTotal && games[nextIndex]) {
                    return { column: 0, row: nextRow };
                }
            }
            return null;
        }

        // Left arrow at first column
        if (key === "ArrowLeft" && currentColumn === 0) {
            // Don't wrap before first row
            if (currentRow === 0) {
                return null;
            }

            const prevRow = currentRow - 1;
            const prevRowStartIndex = prevRow * columns;
            const prevRowEndIndex = Math.min(
                prevRowStartIndex + columns - 1,
                gamesTotal - 1
            );
            const lastColumnInPrevRow = prevRowEndIndex - prevRowStartIndex;

            // Ensure there's a game at target position
            if (prevRowEndIndex < gamesTotal && games[prevRowEndIndex]) {
                return { column: lastColumnInPrevRow, row: prevRow };
            }
            return null;
        }

        return null;
    }

    /** Handle keyboard events for wrapping behavior */
    onKeyDown = (event: React.KeyboardEvent): void => {
        // Only handle left/right arrow keys
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }

        const position = this.getCurrentPosition();
        if (!position) {
            return; // No game selected
        }

        const wrappedPosition = this.calculateWrappedPosition(
            event.key,
            position.column,
            position.row
        );

        if (wrappedPosition && this.props.games) {
            // Calculate target game index
            const targetIndex = wrappedPosition.row * this.cachedColumns + wrappedPosition.column;
            const targetGame = this.props.games[targetIndex];

            if (targetGame) {
                // Prevent ArrowKeyStepper from handling this event
                event.preventDefault();
                event.stopPropagation();

                // Directly select the wrapped game
                this.props.onGameSelect(targetGame);
            }
        }
    };
}
