import React from "react";

interface Details {
    username:string
}

interface Props {
    onsubmit?: (ev:Details) => any
}

export default class LoginForm extends React.Component<Props, Details> {
    public constructor(props:Props) {
        super(props);
        this.state = {username: ''};
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    private handleChange(ev:React.ChangeEvent<HTMLInputElement>) {
        this.setState({username: ev.target.value});
    }

    private handleSubmit(ev:React.FormEvent) {
        this.props.onsubmit?.call(null, this.state);
        ev.preventDefault();
    }

    public render():React.ReactNode {
        return <div>
            <input value={this.state.username} onChange={this.handleChange} />
            <button onClick={this.handleSubmit}>Join Game</button>
        </div>;
    }
}