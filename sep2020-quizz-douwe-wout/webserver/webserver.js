// Modules
const express = require("express");
const websocket = require("ws");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");

// Custom Modules
const database = require("./database");
const quizzerRouter = require("./routers/quizzer_router");
const apiErr = require("./api_error");
const websocketHandler = require("./websocket_handler");

// Constant variables
const WS_PORT = 8080;

let expressApp = express();
let httpServer = http.createServer();

//CORS
expressApp.use(cors({ origin: true, credentials: true }));
expressApp.options("*", cors({ origin: true, credentials: true }));

// Declare Middleware, Routers
expressApp.use(bodyParser.json());
expressApp.use("/quizzers", quizzerRouter);

// Custom Errorhandler
expressApp.use((err, req, res, next) => {
    console.error(err.stack);
    // Check if it's an APIError or Server Error
    if(err instanceof apiErr) {        
        res.status(400).send(err.message);
    } else {
        res.status(500).send(`Oops... something went wrong: ${err.message}`);
    }
});

// WebSockets functionality

httpServer.on("request", expressApp);
httpServer.listen(WS_PORT, () => {
    console.log(`WebServer started on port: ${WS_PORT}`)

    // Setup Connection to MongoDB
    websocketHandler.initWebSocket(httpServer);
    database.connect();
});

process.on("exit", () => {
    database.close();
    httpServer.close(() => console.log("WebServer application is closed."));
})

process.on("SIGTERM", () => {
    httpServer.close(() => console.log("WebServer application is closed."))
});