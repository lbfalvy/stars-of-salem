import React from "react";
import ReactDOM from "react-dom";
import App from './App';
import './index.css';
import { defineComponents } from './Components';
import { setSeed, setHashFunc } from '../shared/uids';

const win = window as unknown as Client.Window;

win.app = {
    components: new Map<string, Client.Component>([

    ]),
};

// These don't need to be secure or unique
setSeed(0);
setHashFunc(d => d);

defineComponents();

ReactDOM.render(<App />, document.getElementById("root"));