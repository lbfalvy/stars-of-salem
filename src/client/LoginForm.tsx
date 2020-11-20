import React from "react";
import './LoginForm.css';

export interface Details {
    showAddress:boolean
    name:string
    address:string
}

interface Props {
    onsubmit: (ev:Details) => any
    title: string
    message?: string
}

export default class LoginForm extends React.Component<Props, Details> {
    public constructor(props:Props) {
        super(props);
        // Get the default address
        const ws_protocol = location.protocol.replace('http', 'ws'); // http => ws, https => wss
        const address = `${ws_protocol}//${location.host}/api`;
        this.state = {name: '', address, showAddress:false};
    }

    private handleNameChange(ev:React.ChangeEvent<HTMLInputElement>) {
        this.setState({name: ev.target.value});
    }

    private handleAddressChange(ev:React.ChangeEvent<HTMLInputElement>) {
        this.setState({address: ev.target.value});
    }

    private handleSubmit(ev:React.FormEvent) {
        this.props.onsubmit(this.state);
        ev.preventDefault();
    }

    public render():React.ReactNode {
        return <div className='login-form fill-parent'>
            <div className='form-container center'>
                <h4>{this.props.title}</h4>
                { this.props.message ? <div className='message'>{this.props.message}</div> : undefined }
                { this.state.showAddress ? 
                    <input value={this.state.address} 
                        onChange={ev => this.handleAddressChange(ev)} />
                    : undefined }
                <input value={this.state.name} onChange={ev => this.handleNameChange(ev)} />
                <button onClick={ev => this.handleSubmit(ev)}>Join Game</button>
            </div>
        </div>;
    }
}