
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const jsonRoutes = require("./routes/jsonRoutes");
const userRoutes = require("./routes/userRoutes");
const setupSocket = require("./socket");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Yappo Backend Server is Running!");
});

app.get("/api/status", (req, res) => {
    res.json({
        project: "Yappo",
        status: "Online"
    });
});

app.use("/api/json", jsonRoutes);
app.use("/api/users", userRoutes);

setupSocket(io);

async function startServer() {
    await connectDB();

    server.listen(PORT, () => {
        console.log(`Yappo server running on http://localhost:${PORT}`);
    });
}

startServer();
