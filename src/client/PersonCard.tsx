import React from "react";
import './PersonCard.css';

export interface PersonDetails {
    name: string
    color: string
}

export function PersonCard(props:PersonDetails):JSX.Element {
    const style = { '--color': props.color } as React.CSSProperties;
    return <div className='person-card' style={style}>
        {props.name}
    </div>;
}