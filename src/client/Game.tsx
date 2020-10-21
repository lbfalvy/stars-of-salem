import React from "react";
import { Connection } from "../shared/connection/Interfaces";
import "./App.css";

export interface GameProps {
    session:Connection
}

export class Game extends React.Component<Readonly<GameProps>, {value:string}> {

    public constructor(props:Readonly<GameProps>){
        super(props);
        this.state = {value: ""};

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    private handleChange(event:React.ChangeEvent<HTMLInputElement>):void {
        this.setState({value: event.target.value});
    }
    
    private handleSubmit():void {
        const message = this.state.value;
        const ws = new WebSocket("ws://localhost:3001");
        ws.onopen = () => {
            ws.send("Handshake opener"); 
            ws.send(message);
        };
    }

    public render():React.ReactNode {
        return(
            <div className="App">
                <h1> Log something else! </h1>
                {/*<input type="text" value={this.state.value} onChange={this.handleChange} />
                <button onClick={this.handleSubmit}>Send data</button>*/}
            </div>
        );
    }
}