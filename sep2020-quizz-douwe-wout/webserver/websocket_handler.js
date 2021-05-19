// Modules
const websocket = require("ws");

// Custom Modules
const quizzerModel = require("./schemas/quizzer_schema");

// AppTypes
const APPTYPES = {
    QM: "QM",
    SB: "SB",
    TM: "TM",
};

const APPTYPES_ARRAY = Object.values(APPTYPES);

// Message Types
const MESSAGETYPES = {
    // QuizMaster messages
    QM_TEAM_APPLICATION: "QM_TEAM_APPLICATION",
    QM_ANSWER_SUBMITTED: "QM_ANSWER_SUBMITTED",
    // Scoreboard messages
    SB_APPLICATION_ACCEPTED: "SB_APPLICATION_ACCEPTED",
    SB_APPLICATION_DONE: "SB_APPLICATION_DONE",
    SB_ROUND_STARTED: "SB_ROUND_STARTED",
    SB_QUESTION_STARTED: "SB_QUESTION_STARTED",
    SB_ANSWER_SUBMITTED: "SB_ANSWER_SUBMITTED",
    SB_QUESTION_ENDED: "SB_QUESTION_ENDED",
    SB_NEXT_QUESTION: "SB_NEXT_QUESTION",
    SB_ROUND_ENDED: "SB_ROUND_ENDED",
    SB_NEXT_ROUND: "SB_NEXT_ROUND",
    SB_END_QUIZZER: "SB_END_QUIZZER",
    // Team messages
    TM_APPLICATION_ACCEPTED: "TM_APPLICATION_ACCEPTED",
    TM_APPLICATION_REJECTED: "TM_APPLICATION_REJECTED",
    TM_APPLICATION_DONE: "TM_APPLICATION_DONE",
    TM_ROUND_STARTED: "TM_ROUND_STARTED",
    TM_QUESTION_STARTED: "TM_QUESTION_STARTED",
    TM_QUESTION_ENDED: "TM_QUESTION_ENDED",
    TM_NEXT_QUESTION: "TM_NEXT_QUESTION",
    TM_ROUND_ENDED: "TM_ROUND_ENDED",
    TM_NEXT_ROUND: "TM_NEXT_ROUND",
    TM_END_QUIZZER: "TM_END_QUIZZER",
}

// Handy Functions for checking a WS Connection
const checkQuizAvailability = async (quizID) => {
    return await quizzerModel.findById(quizID);
};

const checkAppType = (suppliedAppType) => {
    return APPTYPES_ARRAY.includes(suppliedAppType);
};

// Logging function
const logWebSocketConnectionInfo = (quizID, appType, teamID = null) => {
    let appTypeString;
    switch(appType) {
        case APPTYPES.QM:
            appTypeString = "QuizMaster";
            break;
        case APPTYPES.SB:
            appTypeString = "Scoreboard";
            break;
        case APPTYPES.TM:
            appTypeString = "Team";
            break;
        default:
            appTypeString = "Default Case";
            break;
    }
    if (teamID) {
        console.log(`${appTypeString} (${teamID}) has joined quizzer ${quizID}`);
    } else {
        console.log(`${appTypeString} has joined quizzer ${quizID}`);
    }
}

let wsServer;

const initWebSocket = (httpServer) => {
    wsServer = new websocket.Server({
        server: httpServer
    });
    
    // Connect eventHandlers with it's logic
    wsServer.on("connection", async(wsConn, request) => {
        wsConn.on("close", () => {
            if(wsConn.teamID) {
                console.log(`${wsConn.appType} (${wsConn.teamID}) has left quizzer ${wsConn.quizID}`);
            } else {
                console.log(`${wsConn.appType} has left quizzer ${wsConn.quizID}`);
            }
        });

        // Parse Websocket Request URL
        const reqUrl = new URL(request.url, "ws://localhost:8080");
        const quizID = reqUrl.searchParams.get("quizID");
        const appType = reqUrl.searchParams.get("appType");
        const teamID = reqUrl.searchParams.get("teamID");

        // Check if valid args are supplied, else store data about WS Connection
        if(!quizID || !appType || await !checkQuizAvailability(quizID) || !checkAppType(appType)) {
            // Closes connection if Quizzer does not exist or appType is invalid.
            // If no data was supplied in connection request URL, close anyway
            wsConn.close(4000, "[WS - Connection] - Connection could'nt be established, because id and/or apptype were'nt supplied or are invalid.");
        } else if(appType === APPTYPES.TM && !teamID) {
            // If appType is team and TeamID is not supplied, close conn
            wsConn.close(4000, "[WS - Connection] - Connection could'nt be established, because team id was not supplied.");
        }
        else {
            // Store quizID and appType per connected client
            // If team, store teamID aswell
            // This will make it possible to send data to certain clients
            // and app types from certain quizzers.
            wsConn.quizID = quizID;
            wsConn.appType = appType;
            if(wsConn.appType === APPTYPES.TM) {
                wsConn.teamID = teamID;
                logWebSocketConnectionInfo(wsConn.quizID, wsConn.appType, wsConn.teamID);
            } else {
                logWebSocketConnectionInfo(wsConn.quizID, wsConn.appType);
            }
        }
    });
}

// Functions to send data to the specified quizID and appType clients
// For every WebSocket message a function is defined
// WS messages can be found below
// https://github.com/HANICA-DWA/sep2020-quizz-douwe-wout#13-websocket-messages

// Function to get the specified clients
const getClientsFromQuizzer = (quizID) => Array.from(wsServer.clients).filter(client => client.quizID === quizID);
const getSpecifiedClients = (quizID, appType, teamID = null) => Array.from(wsServer.clients).filter(client => client.quizID == quizID && client.appType == appType && client.teamID == teamID);
const getTeamsFromQuiz = quizID => Array.from(wsServer.clients).filter(client => client.quizID == quizID && client.appType == APPTYPES.TM);

// Send WS update to QuizMaster or Scoreboard (appType)
const notifySingleClient = (quizID, appType, messageType, teamID = null) => {
    let client = getSpecifiedClients(quizID, appType, teamID);
    if(client.length === 0) {
        let team = !teamID ? "" : ` & teamID: ${teamID}`;
        console.log(`Client specified by quizID: ${quizID}, appType: ${appType}${team} couldn't be found.`);
    } else {
        // qmClient will be on index 0 because there is one quizMaster, so
        client = client[0];
        const payload = JSON.stringify({type: messageType});
        client.send(payload);
    }
};

// Sends WS update to teams from a quizzer
const notifyTeams = (quizID, messageType) => {
    let clients = getTeamsFromQuiz(quizID);
    if(clients.length === 0) {
        console.log(`Teams in quizID: ${quizID} couldn't be found.`);
    } else {
        const payload = JSON.stringify({type: messageType});
        clients.forEach(client => client.send(payload));
    }
}

const closeTeamConnection = (quizID, teamID) => getSpecifiedClients(quizID, APPTYPES.TM, teamID)[0].close();
const closeConnectionClientsFromQuizzer = quizID => getClientsFromQuizzer(quizID).forEach(client => client.close());

module.exports = { APPTYPES, MESSAGETYPES, initWebSocket, notifySingleClient, notifyTeams, closeTeamConnection, closeConnectionClientsFromQuizzer };