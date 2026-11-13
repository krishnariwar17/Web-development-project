
const { randomUUID } = require("crypto");

function setupSocket(io) {

    // ========================================
    // 1. ONLINE USERS AND MATCHMAKING
    // ========================================

    const onlineUsers = new Set();
    const waitingUsers = [];
    const partners = new Map();
    const rooms = new Map();

    // ========================================
    // 2. HELPER FUNCTIONS
    // ========================================

    function updateOnlineCount() {
        io.emit("onlineCount", onlineUsers.size);
    }

    function removeFromWaiting(userId) {
        let index = waitingUsers.indexOf(userId);

        while (index !== -1) {
            waitingUsers.splice(index, 1);
            index = waitingUsers.indexOf(userId);
        }
    }

    function getAvailablePartner(userId) {

        while (waitingUsers.length > 0) {

            const candidate = waitingUsers.shift();

            if (
                candidate !== userId &&
                onlineUsers.has(candidate) &&
                !partners.has(candidate)
            ) {
                return candidate;
            }
        }

        return null;
    }

    // ========================================
    // 3. END CHAT FUNCTION
    // ========================================

    function endChat(socket) {

        const userId = socket.id;

        removeFromWaiting(userId);

        const partnerId = partners.get(userId);

        if (!partnerId) {
            return;
        }

        const roomId = rooms.get(userId);

        partners.delete(userId);
        partners.delete(partnerId);

        rooms.delete(userId);
        rooms.delete(partnerId);

        socket.leave(roomId);

        const partnerSocket =
            io.sockets.sockets.get(partnerId);

        if (partnerSocket) {

            partnerSocket.leave(roomId);

            partnerSocket.emit(
                "partnerDisconnected",
                {
                    message:
                        "Your partner has left the chat."
                }
            );
        }

        console.log(
            "Chat ended:",
            userId,
            partnerId
        );
    }

    // ========================================
    // 4. SOCKET CONNECTION
    // ========================================

    io.on("connection", (socket) => {

        console.log(
            "User connected:",
            socket.id
        );

        onlineUsers.add(socket.id);

        updateOnlineCount();

        // ====================================
        // 5. START CHAT
        // ====================================

        socket.on("startChat", () => {

            if (partners.has(socket.id)) {
                return;
            }

            if (waitingUsers.includes(socket.id)) {
                return;
            }

            const partnerId =
                getAvailablePartner(socket.id);

            // No waiting user available
            if (!partnerId) {

                waitingUsers.push(socket.id);

                socket.emit("waiting", {
                    message:
                        "No user available. Waiting for someone to join..."
                });

                console.log(
                    "User waiting:",
                    socket.id
                );

                return;
            }

            // =================================
            // MATCH TWO USERS
            // =================================

            const roomId = randomUUID();

            const partnerSocket =
                io.sockets.sockets.get(partnerId);

            if (!partnerSocket) {
                waitingUsers.push(socket.id);

                socket.emit("waiting", {
                    message:
                        "Waiting for another user..."
                });

                return;
            }

            partners.set(socket.id, partnerId);
            partners.set(partnerId, socket.id);

            rooms.set(socket.id, roomId);
            rooms.set(partnerId, roomId);

            socket.join(roomId);
            partnerSocket.join(roomId);

            // Current user creates WebRTC offer
            socket.emit("matched", {
                roomId: roomId,
                initiator: true,
                message: "Partner found!"
            });

            // Waiting user receives WebRTC offer
            partnerSocket.emit("matched", {
                roomId: roomId,
                initiator: false,
                message: "Partner found!"
            });

            console.log(
                "Users matched:",
                socket.id,
                partnerId
            );

            console.log(
                "Room created:",
                roomId
            );
        });

        // ====================================
        // 6. WEBRTC OFFER
        // ====================================

        socket.on("webrtc-offer", ({ offer } = {}) => {

            const partnerId =
                partners.get(socket.id);

            if (!partnerId || !offer) {
                return;
            }

            io.to(partnerId).emit(
                "webrtc-offer",
                {
                    offer: offer
                }
            );

            console.log(
                "WebRTC offer forwarded:",
                socket.id,
                "->",
                partnerId
            );
        });

        // ====================================
        // 7. WEBRTC ANSWER
        // ====================================

        socket.on("webrtc-answer", ({ answer } = {}) => {

            const partnerId =
                partners.get(socket.id);

            if (!partnerId || !answer) {
                return;
            }

            io.to(partnerId).emit(
                "webrtc-answer",
                {
                    answer: answer
                }
            );

            console.log(
                "WebRTC answer forwarded:",
                socket.id,
                "->",
                partnerId
            );
        });

        // ====================================
        // 8. WEBRTC ICE CANDIDATES
        // ====================================

        socket.on(
            "webrtc-ice-candidate",
            ({ candidate } = {}) => {

                const partnerId =
                    partners.get(socket.id);

                if (!partnerId || !candidate) {
                    return;
                }

                io.to(partnerId).emit(
                    "webrtc-ice-candidate",
                    {
                        candidate: candidate
                    }
                );
            }
        );

        // ====================================
        // 9. END CHAT
        // ====================================

        socket.on("endChat", () => {

            endChat(socket);

        });

        // ====================================
        // 10. USER DISCONNECTED
        // ====================================

        socket.on("disconnect", () => {

            endChat(socket);

            onlineUsers.delete(socket.id);

            removeFromWaiting(socket.id);

            updateOnlineCount();

            console.log(
                "User disconnected:",
                socket.id
            );
        });

    });

    console.log(
        "Yappo Socket.IO matchmaking initialized."
    );
}

module.exports = setupSocket;
