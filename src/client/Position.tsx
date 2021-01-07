import React, { ReactNode } from "react";
import AspectRatioBox from "./AspectRatioBox";
import ChannelResolver from "./ChannelResolver";
import FloatingContainer from "./FloatingContainer";
import './Position.css';

export interface Device {
    name: string
    channel?: string
    options?: JsonData
    rect: { 
        x: number, y: number
        w: number, h: number
    }
}

export interface Children {
    name: string
    users: ReactNode[]
    routes: {
        name: string
        users: ReactNode[]
    }[]
    devices: Device[]
}

export interface Props {
    children: Children
    aspectRatio: number
    channels: ChannelResolver
    onSelect: (choice: number) => any,
}

export default function Position(props: Props): JSX.Element {
    const win = window as unknown as Client.Window;
    function onkp(ev: React.KeyboardEvent): void {
        const choice = Number.parseInt(ev.key);
        if (0 < choice && choice <= props.children.routes.length) props.onSelect(choice - 1);
    }
    return (<div className='position' onKeyPress={onkp}>
        <div className='people'>
            {props.children.users}
        </div>
        {props.children.devices.length > 0 ? (
            <AspectRatioBox ratio={props.aspectRatio}>
                {props.children.devices.map(dev => {
                    const Component = win.app.components.get(dev.name);
                    if (Component) return (
                        <FloatingContainer {...dev.rect} key={dev.channel}>
                            <Component init={dev.options} channel={
                                dev.channel ? props.channels.get(dev.channel) : Promise.reject()
                            } />
                        </FloatingContainer>
                    );
                })}
            </AspectRatioBox>
        ) : undefined}
        <ol className='options'>
            {props.children.routes.map((opt, index) => (
                <li key={index} onClick={() => props.onSelect(index)}>
                    <div className='title'>
                        {opt.name}
                    </div>
                    {opt.users.length ? <div className='watching'>
                        People: {opt.users}
                    </div> : null}
                </li>
            ))}
        </ol>
    </div>);
}