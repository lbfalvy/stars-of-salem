import React, { Component} from "react";
import "./App.css";

export class App extends Component{
  public state:{value:string};

  constructor(props:any){
    super(props);
    this.state = {value: ""};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event:React.ChangeEvent<HTMLInputElement>) {
    this.setState({value: event.target.value});
  }

  // eslint-disable-next-line no-unused-vars
  handleSubmit(event:React.MouseEvent) {
    const message = this.state.value;
    const ws = new WebSocket("ws://localhost:3001");
    // eslint-disable-next-line no-unused-vars
    ws.onopen = function (event2) {
      ws.send("Handshake opener"); 
      ws.send(message);
    };
  }

  render(){
    return(
      <div className="App">
        <h1> Log something! </h1>
        <input type="text" value={this.state.value} onChange={this.handleChange} />
        <button onClick={this.handleSubmit}>Send data</button>
      </div>
    );
  }
}