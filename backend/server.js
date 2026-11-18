
const dns = require("node:dns");

// DNS configuration for MongoDB Atlas
if (process.env.NODE_ENV !== "production") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

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

// Render provides its own PORT
const PORT = process.env.PORT || 3000;

// Allowed frontend websites
const allowedOrigins = [
    "http://127.0.0.1:5501",
    "http://localhost:5501"
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(
        process.env.FRONTEND_URL.replace(/\/$/, "")
    );
}

// CORS configuration
const corsOptions = {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO configuration
const io = new Server(server, {
    cors: corsOptions
});

// Test route
app.get("/", (req, res) => {
    res.send("Yappo Backend Server is Running!");
});

// Backend status route
app.get("/api/status", (req, res) => {
    res.json({
        project: "Yappo",
        status: "Online"
    });
});

// API routes
app.use("/api/json", jsonRoutes);
app.use("/api/users", userRoutes);

// Socket.IO matchmaking
setupSocket(io);

// Start server
async function startServer() {
    try {
        await connectDB();

        server.listen(PORT, "0.0.0.0", () => {
            console.log(
                `Yappo server running on port ${PORT}`
            );
        });
    } catch (error) {
        console.error(
            "Failed to start Yappo backend:",
            error.message
        );
        process.exit(1);
    }
}

startServer();
