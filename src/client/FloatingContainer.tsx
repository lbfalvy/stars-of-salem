import React from "react";
import './FloatingContainer.css';

export interface FloatingContainerProps {
    x: number, y: number, w: number, h: number,
    children: any
}
export default function FloatingContainer(props: FloatingContainerProps): JSX.Element {
    return <div className='floating-container' style={{
        left: props.x * 100 + '%',
        top: props.y * 100 + '%',
        width: props.w * 100 + '%',
        height: props.h * 100 + '%'
    }}>{props.children}</div>;
}