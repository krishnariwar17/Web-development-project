
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { YappoWebRTC } from "./webrtc.js";

// ========================================
// 1. FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyCqH5hMhWfkaDd4SbgNe2AZgTcqvXJ0RlM",
    authDomain: "yappo-1cff8.firebaseapp.com",
    projectId: "yappo-1cff8",
    storageBucket: "yappo-1cff8.firebasestorage.app",
    messagingSenderId: "721093115431",
    appId: "1:721093115431:web:cff66a07f3e224232bd802",
    measurementId: "G-L0B3QWPVVW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========================================
// 2. HTML ELEMENTS
// ========================================

const $ = (id) => document.getElementById(id);

const navUsername = $("navUsername");
const accountInfo = $("accountInfo");
const logoutButton = $("logoutButton");

const localVideo = $("localVideo");
const cameraPlaceholder = $("cameraPlaceholder");

const remoteVideo = $("remoteVideo");
const strangerPlaceholder = $("strangerPlaceholder");
const strangerHeading = $("strangerHeading");
const strangerMessage = $("strangerMessage");

const cameraButton = $("cameraButton");
const micButton = $("micButton");
const startChatButton = $("startChatButton");
const nextButton = $("nextButton");
const endChatButton = $("endChatButton");

const cameraStatus = $("cameraStatus");
const cameraFooterStatus = $("cameraFooterStatus");
const partnerStatus = $("partnerStatus");
const connectionStatus = $("connectionStatus");
const dashboardMessage = $("dashboardMessage");

// ========================================
// 3. APPLICATION STATE
// ========================================

let currentUser = null;

let cameraStream = null;
let microphoneStream = null;

let cameraOn = false;
let microphoneOn = false;

let chatRequested = false;
let matched = false;

let socket = null;
let webRTC = null;

let activeRoom = null;
let generation = 0;
let peerReady = false;

let queuedOffer = null;
let queuedAnswer = null;
let queuedCandidates = [];

let authReady = false;

// ========================================
// 4. HELPER FUNCTIONS
// ========================================

function showMessage(message) {
    dashboardMessage.textContent = message;
}

function stopStream(stream) {
    stream?.getTracks().forEach((track) => {
        track.stop();
    });
}

function getFallbackName(user) {
    return user.displayName ||
        (user.email
            ? user.email.split("@")[0]
            : "Yappo User");
}

function setCameraUI(on) {
    cameraOn = on;

    cameraButton.textContent = on
        ? "📹 Turn Camera Off"
        : "📹 Turn Camera On";

    cameraStatus.textContent = on
        ? "Camera on"
        : "Camera off";

    cameraFooterStatus.textContent = on
        ? "Camera is active"
        : "Camera is off";

    cameraStatus.classList.toggle("active", on);
}

function setMicUI(on) {
    microphoneOn = on;

    micButton.textContent = on
        ? "🎙 Turn Mic Off"
        : "🎙 Turn Mic On";

    micButton.setAttribute("aria-pressed", String(on));
}

function showCameraPlaceholder() {
    localVideo.pause();
    localVideo.srcObject = null;
    localVideo.hidden = true;
    cameraPlaceholder.hidden = false;
}

function showStrangerPlaceholder() {
    remoteVideo.pause();
    remoteVideo.srcObject = null;
    remoteVideo.hidden = true;
    strangerPlaceholder.hidden = false;
}

// ========================================
// 5. CHAT RESET AND CLEANUP
// ========================================

function clearPeer() {
    generation++;

    peerReady = false;
    queuedOffer = null;
    queuedAnswer = null;
    queuedCandidates = [];

    activeRoom = null;
    matched = false;

    webRTC?.close();

    showStrangerPlaceholder();
}

function resetChatUI(message = "Chat session ended.") {
    clearPeer();

    chatRequested = false;

    startChatButton.disabled = false;
    nextButton.disabled = true;
    endChatButton.disabled = true;

    strangerHeading.textContent =
        "Your next conversation starts here.";

    strangerMessage.textContent =
        "Start a chat when you're ready to connect.";

    partnerStatus.textContent = "Not connected";
    partnerStatus.classList.remove("active");

    connectionStatus.textContent = "Ready to start";

    showMessage(message);
}

function getLocalMedia() {
    const tracks = [
        ...(cameraStream?.getVideoTracks() || []),
        ...(microphoneStream?.getAudioTracks() || [])
    ].filter((track) => track.readyState === "live");

    return new MediaStream(tracks);
}

// ========================================
// 6. FIREBASE PROFILE
// ========================================

async function loadProfile(user) {
    const fallback = getFallbackName(user);

    navUsername.textContent = fallback;

    accountInfo.textContent =
        user.email || "Signed in to Yappo";

    try {
        const snapshot = await getDoc(
            doc(db, "users", user.uid)
        );

        if (auth.currentUser?.uid !== user.uid) {
            return;
        }

        if (snapshot.exists()) {
            const profile = snapshot.data();

            navUsername.textContent =
                profile.username || fallback;

            const details = [];

            if (profile.age) {
                details.push("Age: " + profile.age);
            }

            if (profile.gender) {
                details.push("Gender: " + profile.gender);
            }

            accountInfo.textContent =
                (user.email || "Signed in to Yappo") +
                (details.length
                    ? " · " + details.join(" · ")
                    : "");
        }

    } catch (error) {
        console.error("Profile loading error:", error);

        showMessage(
            "Signed in, but profile details could not be loaded."
        );
    }
}

// ========================================
// 7. WEBRTC SIGNAL QUEUE
// ========================================

async function handleQueuedSignals() {
    if (!peerReady || !webRTC) return;

    if (queuedOffer) {
        const offer = queuedOffer;
        queuedOffer = null;

        await webRTC.handleOffer(offer);
    }

    if (queuedAnswer && peerReady) {
        const answer = queuedAnswer;
        queuedAnswer = null;

        await webRTC.handleAnswer(answer);
    }

    while (queuedCandidates.length && peerReady) {
        const candidate = queuedCandidates.shift();

        await webRTC.addCandidate(candidate);
    }
}

// ========================================
// 8. SOCKET.IO MATCHMAKING
// ========================================

function connectMatchmaking() {
    if (socket) return;

    if (typeof window.io !== "function") {
        showMessage(
            "Socket.IO client could not load. Check dashboard.html."
        );
        return;
    }

    socket = window.io("http://localhost:3000", {
        reconnection: true,
        reconnectionAttempts: Infinity
    });

    webRTC = new YappoWebRTC(
        socket,
        localVideo,
        remoteVideo,
        (status) => {
            connectionStatus.textContent = status;
            showMessage(status);
        }
    );

    // SERVER CONNECTED

    socket.on("connect", () => {
        console.log("Yappo socket connected:", socket.id);

        if (!chatRequested) {
            connectionStatus.textContent = "Ready to start";

            showMessage(
                "Connected to Yappo server. Turn on your camera/mic and click Start Chat."
            );
        }

        if (chatRequested && !matched) {
            socket.emit("startChat");
        }
    });

    // ONLINE USERS COUNT

    socket.on("onlineCount", (count) => {
        const badge =
            document.querySelector(".online-badge");

        if (badge) {
            badge.textContent = `${count} users online`;
        }
    });

    // WAITING FOR PARTNER

    socket.on("waiting", (data) => {
        if (!chatRequested) return;

        strangerHeading.textContent =
            "Waiting for a partner";

        strangerMessage.textContent =
            data?.message ||
            "No available user. Waiting...";

        partnerStatus.textContent = "Waiting";
        connectionStatus.textContent = "Searching";

        showMessage(
            "Waiting for another user to start a chat."
        );
    });

    // PARTNER FOUND

    socket.on("matched", async (data) => {
        if (!chatRequested || !data?.roomId) return;

        clearPeer();

        const thisGeneration = generation;

        activeRoom = data.roomId;
        matched = true;

        partnerStatus.textContent = "Matched";
        partnerStatus.classList.add("active");

        connectionStatus.textContent =
            "Connecting video";

        strangerHeading.textContent =
            "Connecting video...";

        strangerMessage.textContent =
            "Establishing the peer-to-peer connection.";

        nextButton.disabled = false;

        showMessage(
            "Partner found. Connecting video..."
        );

        try {
            const stream = getLocalMedia();

            if (!stream.getTracks().length) {
                showMessage(
                    "Turn on your camera or microphone before matching to transmit media."
                );
            }

            await webRTC.start(
                stream,
                Boolean(data.initiator)
            );

            if (thisGeneration !== generation) {
                return;
            }

            peerReady = true;

            await handleQueuedSignals();

        } catch (error) {
            console.error(
                "WebRTC startup error:",
                error
            );

            if (thisGeneration === generation) {
                connectionStatus.textContent =
                    "Video failed";

                showMessage(
                    "Could not establish video. Check browser console."
                );
            }
        }
    });

    // WEBRTC OFFER

    socket.on("webrtc-offer", async ({ offer } = {}) => {
        if (!chatRequested || !matched || !offer) {
            return;
        }

        if (!peerReady) {
            queuedOffer = offer;
            return;
        }

        try {
            await webRTC.handleOffer(offer);

        } catch (error) {
            console.error(
                "WebRTC offer error:",
                error
            );
        }
    });

    // WEBRTC ANSWER

    socket.on("webrtc-answer", async ({ answer } = {}) => {
        if (!chatRequested || !matched || !answer) {
            return;
        }

        try {
            if (!peerReady) {
                queuedAnswer = answer;
                return;
            }

            await webRTC.handleAnswer(answer);

        } catch (error) {
            console.error(
                "WebRTC answer error:",
                error
            );
        }
    });

    // WEBRTC ICE CANDIDATES

    socket.on(
        "webrtc-ice-candidate",
        async ({ candidate } = {}) => {
            if (
                !chatRequested ||
                !matched ||
                !candidate
            ) {
                return;
            }

            if (!peerReady) {
                queuedCandidates.push(candidate);
                return;
            }

            try {
                await webRTC.addCandidate(candidate);

            } catch (error) {
                console.error(
                    "WebRTC ICE error:",
                    error
                );
            }
        }
    );

    // PARTNER DISCONNECTED

    socket.on("partnerDisconnected", () => {
        resetChatUI(
            "Your partner has left the chat."
        );
    });

    // SERVER DISCONNECTED

    socket.on("disconnect", () => {
        clearPeer();

        connectionStatus.textContent =
            "Server disconnected";

        if (!chatRequested) {
            showMessage(
                "Yappo server disconnected. Attempting to reconnect..."
            );
        }

        if (chatRequested) {
            connectionStatus.textContent =
                "Reconnecting";

            nextButton.disabled = true;

            showMessage(
                "Server disconnected. Reconnecting..."
            );
        }
    });

    // CONNECTION ERROR

    socket.on("connect_error", (error) => {
        console.error(
            "Socket connection error:",
            error
        );

        showMessage(
            "Cannot connect to the Yappo backend."
        );
    });
}

// ========================================
// 9. AUTHENTICATION CHECK
// ========================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        authReady = false;

        socket?.disconnect();

        window.location.replace("login.html");
        return;
    }

    currentUser = user;
    authReady = true;

    showMessage(
        "Signed in. Connecting to Yappo server..."
    );

    connectMatchmaking();

    if (socket?.connected) {
        showMessage(
            "Connected to Yappo server. Ready to start."
        );
    }

    await loadProfile(user);
});

// ========================================
// 10. CAMERA ON / OFF
// ========================================

cameraButton.addEventListener("click", async () => {
    if (cameraButton.disabled) return;

    // CAMERA CONTROL DURING LIVE CALL

    if (matched) {
        const hasVideoTrack =
            cameraStream?.getVideoTracks().some(
                (track) => track.readyState === "live"
            );

        if (!hasVideoTrack) {
            showMessage(
                "No camera track was added to this call. End the chat, enable the camera, and reconnect."
            );
            return;
        }

        const newState = !cameraOn;

        if (!webRTC?.setCameraEnabled(newState)) {
            showMessage(
                "Camera track is unavailable. Rejoin the call to enable it."
            );
            return;
        }

        setCameraUI(newState);

        if (newState) {
            localVideo.hidden = false;
            cameraPlaceholder.hidden = true;
        } else {
            localVideo.hidden = true;
            cameraPlaceholder.hidden = false;
        }

        showMessage(
            newState
                ? "Camera enabled during call."
                : "Camera disabled during call."
        );

        return;
    }

    // TURN OFF CAMERA BEFORE CALL

    if (cameraOn) {
        stopStream(cameraStream);
        cameraStream = null;

        setCameraUI(false);
        showCameraPlaceholder();

        showMessage("Camera turned off.");
        return;
    }

    // CHECK BROWSER SUPPORT

    if (!navigator.mediaDevices?.getUserMedia) {
        showMessage(
            "Camera requires localhost or HTTPS and browser permission."
        );
        return;
    }

    cameraButton.disabled = true;
    cameraButton.textContent = "Opening camera...";

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user"
                },
                audio: false
            });

        cameraStream = stream;

        localVideo.srcObject = stream;

        cameraPlaceholder.hidden = true;
        localVideo.hidden = false;

        await localVideo.play();

        setCameraUI(true);

        showMessage("Camera is on.");

    } catch (error) {
        console.error(
            "Camera startup failed:",
            error
        );

        stopStream(cameraStream);
        cameraStream = null;

        setCameraUI(false);
        showCameraPlaceholder();

        showMessage(
            error.name === "NotAllowedError"
                ? "Camera permission denied."
                : "Could not start camera: " +
                  error.message
        );

    } finally {
        cameraButton.disabled = false;
        setCameraUI(cameraOn);
    }
});

// ========================================
// 11. MICROPHONE ON / OFF
// ========================================

micButton.addEventListener("click", async () => {
    if (micButton.disabled) return;

    // MICROPHONE CONTROL DURING LIVE CALL

    if (matched) {
        const hasAudioTrack =
            microphoneStream?.getAudioTracks().some(
                (track) => track.readyState === "live"
            );

        if (!hasAudioTrack) {
            showMessage(
                "No microphone track was added to this call. End the chat, enable the microphone, and reconnect."
            );
            return;
        }

        const newState = !microphoneOn;

        if (!webRTC?.setMicrophoneEnabled(newState)) {
            showMessage(
                "Microphone track is unavailable. Rejoin the call to enable it."
            );
            return;
        }

        setMicUI(newState);

        showMessage(
            newState
                ? "Microphone unmuted during call."
                : "Microphone muted during call."
        );

        return;
    }

    // TURN OFF MICROPHONE BEFORE CALL

    if (microphoneOn) {
        stopStream(microphoneStream);
        microphoneStream = null;

        setMicUI(false);

        showMessage("Microphone turned off.");
        return;
    }

    // CHECK BROWSER SUPPORT

    if (!navigator.mediaDevices?.getUserMedia) {
        showMessage(
            "Microphone requires localhost or HTTPS."
        );
        return;
    }

    micButton.disabled = true;
    micButton.textContent = "Opening microphone...";

    try {
        microphoneStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

        setMicUI(true);

        showMessage("Microphone is on.");

    } catch (error) {
        console.error(
            "Microphone startup failed:",
            error
        );

        stopStream(microphoneStream);
        microphoneStream = null;

        setMicUI(false);

        showMessage(
            error.name === "NotAllowedError"
                ? "Microphone permission denied."
                : "Could not start microphone: " +
                  error.message
        );

    } finally {
        micButton.disabled = false;
        setMicUI(microphoneOn);
    }
});

// ========================================
// 12. START CHAT
// ========================================

startChatButton.addEventListener("click", () => {
    if (!authReady || !currentUser || !socket?.connected) {
        showMessage(
            "Wait for your account and server connection."
        );
        return;
    }

    if (chatRequested) return;

    chatRequested = true;

    startChatButton.disabled = true;
    nextButton.disabled = true;
    endChatButton.disabled = false;

    showStrangerPlaceholder();

    strangerHeading.textContent =
        "Finding a partner";

    strangerMessage.textContent =
        "Searching for another available user...";

    partnerStatus.textContent = "Searching";
    connectionStatus.textContent = "Waiting";

    socket.emit("startChat");

    showMessage(
        "Searching for someone to chat with..."
    );
});

// ========================================
// 13. NEXT PARTNER
// ========================================

nextButton.addEventListener("click", () => {
    if (
        !chatRequested ||
        !matched ||
        !socket?.connected
    ) {
        return;
    }

    clearPeer();

    socket.emit("endChat");

    nextButton.disabled = true;

    strangerHeading.textContent =
        "Finding another person";

    strangerMessage.textContent =
        "Searching for your next partner...";

    partnerStatus.textContent = "Searching";
    connectionStatus.textContent = "Waiting";

    socket.emit("startChat");

    showMessage(
        "Looking for another partner..."
    );
});

// ========================================
// 14. END CHAT
// ========================================

endChatButton.addEventListener("click", () => {
    if (socket?.connected) {
        socket.emit("endChat");
    }

    resetChatUI(
        "Chat ended successfully."
    );
});

// ========================================
// 15. LOG OUT
// ========================================

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
        socket?.disconnect();
        socket = null;

        clearPeer();

        stopStream(cameraStream);
        stopStream(microphoneStream);

        cameraStream = null;
        microphoneStream = null;

        await signOut(auth);

        window.location.replace("login.html");

    } catch (error) {
        console.error(
            "Logout failed:",
            error
        );

        showMessage(
            "Could not log out. Please try again."
        );

        logoutButton.disabled = false;
        logoutButton.textContent = "Log Out";
    }
});

// ========================================
// 16. PAGE CLEANUP
// ========================================

window.addEventListener("pagehide", () => {
    socket?.disconnect();

    clearPeer();

    stopStream(cameraStream);
    stopStream(microphoneStream);
});

console.log(
    "Yappo dashboard.js with Socket.IO and WebRTC loaded."
);
