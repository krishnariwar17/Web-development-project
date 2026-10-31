
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";


// ========================================
// 1. FIREBASE
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
// 2. PAGE ELEMENTS
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
// 3. APP STATE
// ========================================

let currentUser = null;
let cameraStream = null;
let microphoneStream = null;
let cameraOn = false;
let microphoneOn = false;
let chatRequested = false;


// ========================================
// 4. GENERAL HELPERS
// ========================================

function showMessage(message) {
    dashboardMessage.textContent = message;
}

function stopStream(stream) {
    if (!stream) return;

    stream.getTracks().forEach((track) => {
        track.stop();
    });
}

function getFallbackName(user) {
    return user.displayName ||
        (user.email ? user.email.split("@")[0] : "Yappo User");
}

function setCameraUI(isOn) {
    cameraOn = isOn;

    cameraButton.textContent = isOn
        ? "📹 Turn Camera Off"
        : "📹 Turn Camera On";

    cameraStatus.textContent = isOn
        ? "Camera on"
        : "Camera off";

    cameraFooterStatus.textContent = isOn
        ? "Camera is active"
        : "Camera is off";

    cameraStatus.classList.toggle("active", isOn);
}

function setMicUI(isOn) {
    microphoneOn = isOn;

    micButton.textContent = isOn
        ? "🎙 Turn Mic Off"
        : "🎙 Turn Mic On";

    micButton.setAttribute("aria-pressed", String(isOn));
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
// 5. LOAD PROFILE AND USERNAME
// ========================================

async function loadProfile(user) {
    const fallbackName = getFallbackName(user);

    // Show the available account details immediately.
    navUsername.textContent = fallbackName;
    accountInfo.textContent = user.email || "Signed in to Yappo";

    try {
        const reference = doc(db, "users", user.uid);
        const snapshot = await getDoc(reference);

        // Do not update the page for a previous user.
        if (auth.currentUser?.uid !== user.uid) return;

        if (snapshot.exists()) {
            const profile = snapshot.data();

            navUsername.textContent =
                profile.username || fallbackName;

            const details = [];

            if (profile.age) {
                details.push("Age: " + profile.age);
            }

            if (profile.gender) {
                details.push("Gender: " + profile.gender);
            }

            accountInfo.textContent =
                (user.email || "Signed in to Yappo") +
                (details.length ? " · " + details.join(" · ") : "");
        }
    } catch (error) {
        console.error("Profile loading error:", error);

        // Authentication still works if profile loading fails.
        showMessage(
            "Signed in successfully. Profile details could not be " +
            "loaded from Firestore."
        );
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;
    await loadProfile(user);
});


// ========================================
// 6. CAMERA ON / OFF
// ========================================

cameraButton.addEventListener("click", async () => {
    if (cameraButton.disabled) return;

    if (cameraOn) {
        stopStream(cameraStream);
        cameraStream = null;

        setCameraUI(false);
        showCameraPlaceholder();

        showMessage("Camera turned off.");
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        showMessage(
            "Camera access is unavailable. Open this page using " +
            "VS Code Live Server or HTTPS."
        );
        return;
    }

    cameraButton.disabled = true;
    cameraButton.textContent = "Opening camera...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            },
            audio: false
        });

        // If the page was left while permission was pending,
        // do not keep the newly opened camera running.
        if (!document.body.isConnected) {
            stopStream(stream);
            return;
        }

        cameraStream = stream;
        localVideo.srcObject = cameraStream;

        // Hide the placeholder before starting playback.
        cameraPlaceholder.hidden = true;
        localVideo.hidden = false;

        await localVideo.play();

        setCameraUI(true);
        showMessage("Camera is on. Your live preview is active.");

    } catch (error) {
        console.error("Camera startup failed:", error);

        stopStream(cameraStream);
        cameraStream = null;

        setCameraUI(false);
        showCameraPlaceholder();

        if (error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError") {
            showMessage(
                "Camera permission denied. Allow camera access " +
                "for this site in your browser settings."
            );
        } else if (error.name === "NotFoundError" ||
                   error.name === "DevicesNotFoundError") {
            showMessage("No camera was found. Connect or enable a webcam.");
        } else if (error.name === "NotReadableError" ||
                   error.name === "TrackStartError") {
            showMessage(
                "The camera is busy or unavailable. Close other apps " +
                "using it and try again."
            );
        } else if (error.name === "OverconstrainedError") {
            showMessage(
                "The requested camera settings are unsupported. " +
                "Try another camera."
            );
        } else {
            showMessage(
                "Could not start the camera: " +
                (error.message || error.name || "Unknown error")
            );
        }

    } finally {
        cameraButton.disabled = false;
        cameraButton.textContent = cameraOn
            ? "📹 Turn Camera Off"
            : "📹 Turn Camera On";
    }
});


// ========================================
// 7. MICROPHONE ON / OFF
// ========================================

micButton.addEventListener("click", async () => {
    if (micButton.disabled) return;

    if (microphoneOn) {
        stopStream(microphoneStream);
        microphoneStream = null;

        setMicUI(false);
        showMessage("Microphone turned off.");
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        showMessage(
            "Microphone access is unavailable. Use Live Server or HTTPS."
        );
        return;
    }

    micButton.disabled = true;
    micButton.textContent = "Opening microphone...";

    try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        setMicUI(true);
        showMessage("Microphone is on and capturing audio.");

    } catch (error) {
        console.error("Microphone startup failed:", error);

        stopStream(microphoneStream);
        microphoneStream = null;

        setMicUI(false);

        if (error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError") {
            showMessage(
                "Microphone permission denied. Allow microphone access " +
                "for this site in your browser settings."
            );
        } else if (error.name === "NotFoundError") {
            showMessage("No microphone was found on this device.");
        } else {
            showMessage(
                "Could not start the microphone: " +
                (error.message || error.name || "Unknown error")
            );
        }

    } finally {
        micButton.disabled = false;
        setMicUI(microphoneOn);
    }
});


// ========================================
// 8. START CHAT
// ========================================

startChatButton.addEventListener("click", () => {
    if (!currentUser) {
        showMessage("Wait for your account to finish loading.");
        return;
    }

    chatRequested = true;

    startChatButton.disabled = true;
    nextButton.disabled = false;
    endChatButton.disabled = false;

    strangerHeading.textContent = "Waiting for a connection";
    strangerMessage.textContent =
        "The Yappo matchmaking service is not connected yet.";

    partnerStatus.textContent = "Waiting for a match";
    connectionStatus.textContent = "Searching for a partner";

    showStrangerPlaceholder();

    showMessage(
        "The chat interface is ready. To connect two real users, " +
        "Yappo still needs a matchmaking service and WebRTC signaling."
    );
});


// ========================================
// 9. NEXT
// ========================================

nextButton.addEventListener("click", () => {
    if (!chatRequested) {
        showMessage("Start a chat first.");
        return;
    }

    showStrangerPlaceholder();

    strangerHeading.textContent = "Looking for another person";
    strangerMessage.textContent =
        "Live stranger matching has not been implemented yet.";

    partnerStatus.textContent = "Not connected";
    connectionStatus.textContent = "No match available";

    showMessage(
        "The Next button works, but finding a new person requires " +
        "a matchmaking backend."
    );
});


// ========================================
// 10. END CHAT
// ========================================

endChatButton.addEventListener("click", () => {
    chatRequested = false;

    startChatButton.disabled = false;
    nextButton.disabled = true;
    endChatButton.disabled = true;

    showStrangerPlaceholder();

    strangerHeading.textContent =
        "Your next conversation starts here.";

    strangerMessage.textContent =
        "Start a chat when you're ready to connect.";

    partnerStatus.textContent = "Not connected";
    partnerStatus.classList.remove("active");

    connectionStatus.textContent = "Ready to start";

    showMessage("Chat session ended.");
});


// ========================================
// 11. LOG OUT
// ========================================

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
        stopStream(cameraStream);
        stopStream(microphoneStream);

        cameraStream = null;
        microphoneStream = null;

        await signOut(auth);
        window.location.replace("login.html");

    } catch (error) {
        console.error("Logout failed:", error);

        showMessage("Could not log out. Please try again.");

        logoutButton.disabled = false;
        logoutButton.textContent = "Log Out";
    }
});


// ========================================
// 12. CLEANUP
// ========================================

window.addEventListener("pagehide", () => {
    stopStream(cameraStream);
    stopStream(microphoneStream);
});

console.log("Yappo dashboard.js loaded.");
