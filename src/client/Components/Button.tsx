import React from "react";
import { Component, ReactNode, MouseEvent } from "react";
import './Button.css';

interface ButtonState {
    connection?: Net.Connection
}

class Button extends Component<Client.ComponentParams, ButtonState> {
    public state: ButtonState = {}
    public constructor(props: Client.ComponentParams) {
        super(props);
        props.channel.then(connection => this.setState({ connection }));
    }

    private onClick(_ev: MouseEvent) {
        this.state.connection?.send("activate");
    }

    public render(): ReactNode {
        return (
            <button className='button' disabled={this.state.connection === undefined}
                onClick={ev => this.onClick(ev)}>
                {this.props.init}
            </button>
        );
    }

    public static create(props: Client.ComponentParams): JSX.Element {
        return <Button {...props} />;
    }
}

export default Button.create;