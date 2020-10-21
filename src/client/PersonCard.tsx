import React from "react";
import './PersonCard.css';

export interface PersonDetails {
    name: string
    color: string
}

export class PersonCard extends React.Component<PersonDetails> {
    public constructor(props: Readonly<PersonDetails>) {
        super(props);
    }

    public render(): React.ReactNode {
        const style = { '--color': this.props.color } as React.CSSProperties;
        return (
            <div className='person-card' style={style}>
                {this.props.name}
            </div>
        );
    }
}