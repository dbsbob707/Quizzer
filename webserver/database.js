// Modules
const mongoose = require("mongoose");

// Constant variables
const MONGODB_NAME = "quizzer_database";
const MONGODB_URI = `mongodb://localhost/${MONGODB_NAME}`;

let dbConnection;

connect = () => { 
    console.log(`Trying to connect to MongoDB: ${MONGODB_URI}`);
    dbConnection = mongoose.connect(MONGODB_URI, 
        { 
            useNewUrlParser: true ,
            useUnifiedTopology: true,
            useFindAndModify: false
        },
        (err) => {
            // Exit the WebServer, because DB Connection is necessary
            if (err) {
                console.error(`Connection to MongoDB Failed: ${err.message}`);
                process.kill(process.pid, "SIGTERM");
            }
        }
    );
}

close = () => {
    dbConnection.close();
}

module.exports = {
    connect,
    close
}