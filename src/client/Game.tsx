import React, { ReactNode } from "react";
import "./App.css";
import Position from './Position';
import { PersonCard } from "./PersonCard";
import ChannelResolver from "./ChannelResolver";

export interface GameProps {
    channels: ChannelResolver
    control: Net.Connection
}

interface GameState {
    position: Transfer.Position
}

export class Game extends React.Component<Readonly<GameProps>, GameState> {
    public state = { position: {
        typeid: 'Position',
        name: 'Loading...',
        space: 'Limbo',
        players: [], routes: [], devices: [], aspectRatio: 1
    } as Transfer.Position }

    public constructor(props: Readonly<GameProps>){
        super(props);
        props.control.message.on(data => {
            if (typeof data !== 'string') throw new Error('Received binary on the control channel');
            this.handleMessage(JSON.parse(data));
        });
        this.send({ typeid: 'Refresh' });
    }

    // we shouldn't be rendering in this function
    public handleMessage(msg: Transfer.AnyMessage): void {
        console.debug('Received message', msg);
        if (msg.typeid == 'Position') this.setState({ position: msg });
    }

    private send(msg: Transfer.AnyMessage) {
        this.props.control.send(JSON.stringify(msg));
    }

    private move(route: number) {
        this.send({
            typeid: 'Move',
            route
        } as Transfer.Move);
    }

    public render(): ReactNode {
        const position = this.state.position;
        return(
            <div className="App">
                <Position onSelect={choice => this.move(choice)} 
                    channels={this.props.channels} aspectRatio={position.aspectRatio}>
                    {{
                        name: position.name,
                        users: position.players.map(p => (
                            <PersonCard key={p.name} name={p.name} color='red' />
                        )),
                        routes: position.routes.map(route => ({
                            name: route.name,
                            users: route.players.map(p => (
                                <PersonCard key={p.name} name={p.name} color='red' />
                            ))
                        })),
                        devices: position.devices?.map(transfer => ({
                            name: transfer.component,
                            channel: transfer.channel,
                            options: transfer.componentOptions,
                            rect: transfer.position
                        })) ?? []
                        
                    }}
                </Position>
            </div>
        );
    }
}