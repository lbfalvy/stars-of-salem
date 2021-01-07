import React from "react";

interface Props {
    ratio: number
    children: React.ReactNode
}

export default function AspectRatioBox(props: Props): JSX.Element {
    const width = 1000 * props.ratio;
    return <svg viewBox={`0 0 ${width} 1000`} preserveAspectRatio='xMidYMid meet'>
        <foreignObject width={width} height='1000' x='0' y='0' 
            requiredExtensions='http://www.w3.org/1999/xhtml'>
            <body>
                {props.children}
            </body>
        </foreignObject>
    </svg>;
}