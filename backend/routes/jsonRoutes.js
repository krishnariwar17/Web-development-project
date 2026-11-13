
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const filePath = path.join(__dirname, "../data/sessions.json");

function readSessions() {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveSessions(sessions) {
    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
}

// GET - Fetch all sessions
router.get("/sessions", (req, res) => {
    try {
        const sessions = readSessions();
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: "Unable to read sessions" });
    }
});

// POST - Create a new session
router.post("/sessions", (req, res) => {
    try {
        const { user1, user2 } = req.body;

        if (!user1 || !user2 || user1 === user2) {
            return res.status(400).json({
                message: "Provide two different users"
            });
        }

        const sessions = readSessions();

        const newSession = {
            id: require("crypto").randomUUID(),
            user1,
            user2,
            status: "active",
            createdAt: new Date().toISOString()
        };

        sessions.push(newSession);
        saveSessions(sessions);

        res.status(201).json({
            message: "Session created successfully",
            session: newSession
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to create session" });
    }
});

// DELETE - Remove a session
router.delete("/sessions/:id", (req, res) => {
    try {
        const sessions = readSessions();
        const updatedSessions = sessions.filter(
            session => session.id !== req.params.id
        );

        if (sessions.length === updatedSessions.length) {
            return res.status(404).json({
                message: "Session not found"
            });
        }

        saveSessions(updatedSessions);

        res.json({ message: "Session deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete session" });
    }
});

module.exports = router;
