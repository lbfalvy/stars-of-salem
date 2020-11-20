import React from "react";
import { Connection } from "../shared/connection/Interfaces";
import "./App.css";
import * as Messages from '../shared/Messages';
import * as Position from './Position';
import { PersonCard } from "./PersonCard";
import ChannelResolver from "./ChannelResolver";

export interface GameProps {
    channels:ChannelResolver
    control:Connection
}

interface GameState {
    position:Position.Children
}

export class Game extends React.Component<Readonly<GameProps>, GameState> {
    public state = { position: { name: '', users:[], routes:[] } }

    public constructor(props:Readonly<GameProps>){
        super(props);
    }

    public handleMessage(msg: Messages.Message):void {
        if (Messages.is(msg, Messages.Position)) {
            const users = msg.users.filter(p => p.position == msg.name).map(this.renderPlayer);
            const routes = msg.routes.map(route => ({
                name: route,
                users: msg.users.filter(player => player.position == route).map(this.renderPlayer)
            }));
            this.setState({ position: { name:msg.name, routes, users } });
        }
    }

    private send(msg:Messages.Message) {
        this.props.control.send(JSON.stringify(msg));
    }

    private move(route:number) {
        this.send(new Messages.Move(route));
    }

    private renderPlayer(player:Messages.Player) {
        return <PersonCard key={player.name} name={player.name} color='red' />;
    }

    public render():React.ReactNode {
        return(
            <div className="App">
                <Position.Component onSelect={this.move}>
                    {this.state.position}
                </Position.Component>
            </div>
        );
    }
}