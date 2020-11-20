import React, { ReactNode } from "react";
import './Position.css';

export interface Children {
    name: string
    users: ReactNode[]
    routes: {
        name: string,
        users: ReactNode[]
    }[]
}

export interface Props {
    children: Children
    onSelect: (choice:number) => any
}

export const Component: React.FunctionComponent<Props> = (({ onSelect, children }) => {
    function onkp(ev: React.KeyboardEvent): void {
        const choice = Number.parseInt(ev.key);
        if (0 < choice && choice <= children.routes.length) {
            onSelect(choice-1);
        }
    }

    return <div className='room' /*style={{ backgroundImage: `url(${image})` }}*/ onKeyPress={onkp}>
        <div className='people'>
            {children.users}
        </div>
        <ol className='options'>
            {children.routes.map((opt, index) => <li onClick={() => onSelect(index)}>
                <div className='title'>
                    <span className="number">{index+1}.</span>
                    {opt.name}
                </div>
                {opt.users.length ? <div className='watching'>
                    People: {opt.users}
                </div> : null}
            </li>)}
        </ol>
    </div>;
});
export default Component;