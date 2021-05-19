import React from 'react';
import ReactDOM from 'react-dom';

import { BrowserRouter as Router } from "react-router-dom";

import * as Redux from 'redux';
import * as ReactRedux from 'react-redux';
import thunkMiddleware from 'redux-thunk'

import App from './Components/App';

// Websocket Reducer library
import reduxWebsocket from '@giantmachines/redux-websocket';

// Custom Reducers
import quizReducer from './Reducers/QuizReducer';
import wsReducer from './Reducers/WsReducer';

export const WebServerAddress = 'http://localhost:8080/quizzers';
export const WebSocketAddress = 'ws://localhost:8080/?appType=TM'; 

const mainReducer = Redux.combineReducers({
  quizzer: quizReducer,
  websocket: wsReducer,
});

const middleware = [thunkMiddleware, reduxWebsocket()];

const store = Redux.createStore(
  mainReducer,
  Redux.compose(
    Redux.applyMiddleware(
      ...middleware
    ),
    window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__() : f => f
  )
);

const mainComponent = (
  <ReactRedux.Provider store={store}>
    <Router>
      <App />
    </Router>
  </ReactRedux.Provider >
)

ReactDOM.render(
  mainComponent,
  document.getElementById('root')
);