import React from 'react';
import './ReconnectingOverlay.css';

export default class ReconnectingOverlay extends React.Component<unknown, {dots:number}> {
    private interval:ReturnType<typeof setInterval> | undefined;
    public state = { dots:0 };
    public componentDidMount():void {
        this.interval = setInterval(() => this.setState({dots: (this.state.dots + 1) % 5}), 300);
    }
    public render():React.ReactNode {
        return <div className='reconnecting-overlay fill-parent'>
            <div className='center'>Reconnecting{'.'.repeat(this.state.dots)}</div>
        </div>;
    }
}