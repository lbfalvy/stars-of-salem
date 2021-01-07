import React from "react";
import { Component, ReactNode } from "react";
import { getUid } from "../../shared/uids";
import './SingleSelect.css';

interface SingleSelectState {
    options: Array<string>
    choice: string
    connection?: Net.Connection
}

class SingleSelect extends Component<Client.ComponentParams, SingleSelectState> {
    public state: SingleSelectState = {
        choice: '',
        options: []
    }
    private readonly uid = getUid();
    public constructor(props: Client.ComponentParams) {
        super(props);
        props.channel.then(connection => {
            this.setState({ connection });
            connection.message.on(msg => {
                const data = JSON.parse(msg as string);
                if (data.options instanceof Array) {
                    this.setState({ options: data.options });
                }
                if (typeof data.value === 'string') {
                    this.setState({ choice: data.value });
                }
            });
        });
    }

    private onSelect(option: string) {
        if (this.state.choice == option) return;
        this.state.connection?.send(option);
    }

    public render(): ReactNode {
        return (
            <div className='single-select'>
                {this.state.options.map(opt => (
                    <label key={opt}>
                        <button name={this.uid} value={opt} 
                            disabled={this.state.connection == undefined}
                            className={this.state.choice == opt ? 'active' : undefined}
                            onClick={() => this.onSelect(opt)}>
                            {opt}
                        </button>
                    </label>
                ))}
            </div>
        );
    }

    public static create(props: Client.ComponentParams): JSX.Element {
        return <SingleSelect {...props} />;
    }
}

export default SingleSelect.create;