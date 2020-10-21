import React, { ReactNode } from "react";
import './Room.css';

export interface Option {
    title: string,
    onSelect: () => any,
    operator?: ReactNode,
    watching?: ReactNode
}

export interface RoomChildren {
    idle: ReactNode,
    options: Option[]
}

export interface RoomProps {
    image: string,
    children: RoomChildren
}

export const Room: React.FunctionComponent<RoomProps> = ({ image, children }) => {
    function onkp(ev: React.KeyboardEvent): void {
        const choice = Number(ev.key);
        if (0 <= choice && choice < children.options.length) {
            children.options[choice].onSelect();
        }
    }
    return <div className='room' style={{ backgroundImage: `url(${image})` }} onKeyPress={onkp}>
        <div className='people'>
            {children.idle}
        </div>
        <ol className='options'>
            {children.options.map(opt => <li onClick={() => opt.onSelect()}>
                <div className='title'>{opt.title}</div>
                {opt.operator ? <div className='operator'>
                    Operator: {opt.operator}
                </div> : null}
                {opt.watching ? <div className='watching'>
                    Spectators: {opt.watching}
                </div> : null}
            </li>)}
        </ol>
    </div>;
};