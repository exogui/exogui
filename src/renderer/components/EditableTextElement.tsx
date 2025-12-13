import * as React from "react";

export type EditableTextElementArgs<T = undefined> = {
    /** Leave "edit mode" and discard the edited text. */
    cancelEdit: () => void;
    /** Leave "edit mode" and "lock in" the edited text. */
    confirmEdit: () => void;
    /** If this is in "edit mode" (instead of "view mode"). */
    editing: boolean;
    /** Extra props passed by the parent. */
    extra: T;
    /** Call this whenever the input is changed (while in "edit mode"). */
    onInputChange: (event: React.ChangeEvent<{ value: string }>) => void;
    /** Call this whenever a key is pressed (while in "edit mode" and the text element is receiving the input). */
    onInputKeyDown: (event: React.KeyboardEvent) => void;
    /** Enter "edit mode". */
    startEdit: () => void;
    /** Current text. */
    text: string;
};

export type EditableTextElementKeyArgs = {
    /** Cancel edit (discard changes). */
    cancel: () => void;
    /** Confirm edit ("lock in" changes). */
    confirm: () => void;
    /** Keyboard event. */
    event: React.KeyboardEvent;
};

export type EditableTextElementProps<T> = {
    /** Function that renders the text element (render prop). */
    children?: (args: EditableTextElementArgs<T>) => React.JSX.Element | null;
    /** If the element is editable (if it can enter "edit mode"). */
    editable?: boolean;
    /** Called when editing is confirmed (when the user is done editing and attempts to "lock in" the edited text). */
    onEditConfirm?: (text: string) => void;
    /** Called when editing is cancelled (when the user is done editing and attempts to discard the edited text). */
    onEditCancel?: (text: string) => void;
    /** Called when a key is pushed down while editing (called from the render prop argument "onInputKeyDown"). */
    onEditKeyDown?: (args: EditableTextElementKeyArgs) => void;
    /** Text to be displayed (and to edit when it enters "edit mode"). */
    text: string;
} & (T extends undefined
    ? {
          /** Extra props to pass through to the child. */
          extra?: undefined;
      }
    : {
          /** Extra props to pass through to the child. */
          extra: T;
      });

/**
 * A "render prop" component that stores and manages state for an editable text field.
 * Note that this is an old component that should probably be replaced with something nicer.
 */
export function EditableTextElement<T>(props: EditableTextElementProps<T>) {
    // State
    const { editable, onEditCancel, onEditConfirm, onEditKeyDown, text: textProp } = props;
    const [editing, setEditing] = React.useState(false);
    const [text, setText] = React.useState(textProp);
    // Callbacks
    const startEdit = React.useCallback((): void => {
        if (editable) {
            setEditing(true);
        }
    }, [editable]);
    const cancelEdit = React.useCallback((): void => {
        setEditing(false);
        if (onEditCancel) {
            onEditCancel(text);
        }
    }, [onEditCancel, text]);
    const confirmEdit = React.useCallback((): void => {
        setEditing(false);
        if (onEditConfirm) {
            onEditConfirm(text);
        }
    }, [onEditConfirm, text]);
    const onInputChange = React.useCallback(
        (event: React.ChangeEvent<{ value: string }>): void => {
            setText(event.target.value);
        },
        [setText],
    );
    const onInputKeyDown = React.useCallback(
        (event: React.KeyboardEvent): void => {
            if (editing) {
                const func =
                    onEditKeyDown || EditableTextElement.onEditKeyDown;
                func({
                    event,
                    cancel: cancelEdit,
                    confirm: confirmEdit,
                });
            }
        },
        [cancelEdit, confirmEdit, editing, onEditKeyDown],
    );
    // Stop editing if no longer editable
    if (!editable && editing) {
        setEditing(false);
    }
    // Update text while not editing
    if (!editing && text !== textProp) {
        setText(textProp);
    }
    // Render
    return (
        (props.children &&
            props.children({
                cancelEdit: cancelEdit,
                confirmEdit: confirmEdit,
                editing: editing,
                extra: props.extra as any,
                onInputChange: onInputChange,
                onInputKeyDown: onInputKeyDown,
                startEdit: startEdit,
                text: text,
            })) || <></>
    );
}

export namespace EditableTextElement {

    /** Default callback for the "onEditKeyDown" prop. */
    export const onEditKeyDown = ({
        event,
        cancel,
        confirm,
    }: EditableTextElementKeyArgs): void => {
        if (event.key === "Enter" && !event.shiftKey) {
            confirm();
        } else if (event.key === "Escape") {
            cancel();
        }
    };
}
