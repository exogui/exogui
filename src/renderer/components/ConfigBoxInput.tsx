import * as React from "react";
import { ConfigBox, ConfigBoxProps } from "./ConfigBox";
import { InputField } from "./InputField";

export type ConfigBoxInputProps = ConfigBoxProps & {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
};

export function ConfigBoxInput(props: ConfigBoxInputProps) {
    return (
        <ConfigBox
            {...props}
            contentClassName={`${props.contentClassName || ""} setting__row__content--input-field`}
        >
            <InputField
                text={props.value}
                placeholder={props.placeholder}
                onChange={(event) => props.onChange(event.target.value)}
                disabled={props.disabled}
            />
        </ConfigBox>
    );
}

export type ConfigBoxNumberInputProps = ConfigBoxProps & {
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
};

export function ConfigBoxNumberInput(props: ConfigBoxNumberInputProps) {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(event.target.value, 10);
        if (!isNaN(val)) {
            props.onChange(val);
        }
    };

    return (
        <ConfigBox
            {...props}
            contentClassName={`${props.contentClassName || ""} setting__row__content--input-field`}
        >
            <input
                type="number"
                className="input-field input-field--edit"
                value={props.value}
                onChange={handleChange}
                placeholder={props.placeholder}
                disabled={props.disabled}
                min={props.min}
                max={props.max}
            />
        </ConfigBox>
    );
}
