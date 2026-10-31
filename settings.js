
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

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

// Switch between settings sections.
document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll("[data-panel]").forEach(item => {
            item.classList.remove("active");
        });

        document.querySelectorAll(".setting-panel").forEach(panel => {
            panel.classList.remove("active");
        });

        button.classList.add("active");
        document.getElementById(button.dataset.panel)
            .classList.add("active");
    });
});

// Load the signed-in user's profile.
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    document.getElementById("accountEmail").textContent =
        user.email || "Not available";

    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));

        if (snapshot.exists()) {
            const profile = snapshot.data();

            document.getElementById("accountName").textContent =
                profile.username || "Not set";

            document.getElementById("accountAge").textContent =
                profile.age ?? "Not set";

            document.getElementById("accountGender").textContent =
                profile.gender || "Not set";

            document.getElementById("accountHobbies").textContent =
                Array.isArray(profile.hobbies)
                    ? profile.hobbies.join(", ")
                    : "Not set";
        } else {
            document.getElementById("accountMessage").textContent =
                "Complete your profile to see your information.";

            document.querySelector("#account .back-button").textContent =
                "Complete Profile";
        }
    } catch (error) {
        console.error(error);
        document.getElementById("accountMessage").textContent =
            "Could not load your profile. Check your Firestore setup.";
    }
});

// Load preferences saved in this browser.
const preferenceKey = "yappoPreferences";

let preferences = {};

try {
    preferences = JSON.parse(
        localStorage.getItem(preferenceKey) || "{}"
    );
} catch {
    preferences = {};
}

document.getElementById("language").value =
    preferences.language || "English";

document.getElementById("matchGender").value =
    preferences.matchGender || "everyone";

document.getElementById("cameraPreference").checked =
    preferences.cameraPreference ?? true;

document.getElementById("savePreferences").addEventListener("click", () => {
    preferences = {
        language: document.getElementById("language").value,
        matchGender: document.getElementById("matchGender").value,
        cameraPreference:
            document.getElementById("cameraPreference").checked
    };

    localStorage.setItem(preferenceKey, JSON.stringify(preferences));

    document.getElementById("preferencesMessage").textContent =
        "Preferences saved in this browser.";
});

// Prepare a feedback email.
document.getElementById("sendFeedback").addEventListener("click", () => {
    const message = document.getElementById("contactMessage").value.trim();
    const status = document.getElementById("contactStatus");

    if (!message) {
        status.textContent = "Please enter your message first.";
        return;
    }

    // Replace this address with your real support email.
    const supportEmail = "YOUR_SUPPORT_EMAIL@example.com";

    if (supportEmail.includes("YOUR_SUPPORT_EMAIL")) {
        status.textContent =
            "Replace the placeholder support email in settings.js first.";
        return;
    }

    const subject = encodeURIComponent("Yappo Feedback");
    const body = encodeURIComponent(message);

    window.location.href =
        `mailto:${supportEmail}?subject=${subject}&body=${body}`;
});

// Log out.
document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("login.html");
    } catch (error) {
        console.error(error);
        document.getElementById("accountMessage").textContent =
            "Could not sign out. Please try again.";
    }
});
