
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
    getDoc,
    setDoc
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// 1. Firebase configuration

const firebaseConfig = {
    apiKey: "AIzaSyCqH5hMhWfkaDd4SbgNe2AZgTcqvXJ0RlM",
    authDomain: "yappo-1cff8.firebaseapp.com",
    projectId: "yappo-1cff8",
    storageBucket: "yappo-1cff8.firebasestorage.app",
    messagingSenderId: "721093115431",
    appId: "1:721093115431:web:cff66a07f3e224232bd802",
    measurementId: "G-L0B3QWPVVW"
};

// 2. Start Firebase

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. Get HTML elements

const form = document.getElementById("profileForm");
const message = document.getElementById("profileMessage");
const saveButton = document.getElementById("saveProfile");
const logoutButton = document.getElementById("logoutButton");

const usernameInput = document.getElementById("username");
const ageInput = document.getElementById("age");
const genderInput = document.getElementById("gender");

let currentUser = null;
let profileLoaded = false;

// True when the user opens profile.html?edit=1
const editingProfile =
    new URLSearchParams(window.location.search).get("edit") === "1";

// Show messages on the page

function showMessage(text) {
    message.textContent = text;
}

// 4. Load the user's account and existing profile

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;
    saveButton.disabled = true;
    showMessage("Loading your profile...");

    try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (profileSnapshot.exists()) {
            const profile = profileSnapshot.data();

            // Existing users normally go straight to the dashboard.
            if (!editingProfile) {
                window.location.replace("dashboard.html");
                return;
            }

            // Fill in the saved profile for editing.
            usernameInput.value = profile.username || "";
            ageInput.value = profile.age ?? "";
            genderInput.value = profile.gender || "";

            const savedHobbies = Array.isArray(profile.hobbies)
                ? profile.hobbies
                : [];

            document
                .querySelectorAll('input[name="hobby"]')
                .forEach(input => {
                    input.checked = savedHobbies.includes(input.value);
                });

            saveButton.textContent = "Update Profile";
            showMessage("Edit your details below.");
        } else {
            // First-time users get suggested information.
            usernameInput.value =
                user.displayName ||
                (user.email ? user.email.split("@")[0] : "");

            saveButton.textContent = "Complete Profile";
            showMessage("Tell us a little about yourself.");
        }

        profileLoaded = true;
        saveButton.disabled = false;

    } catch (error) {
        console.error("Profile loading error:", error);

        showMessage(
            "Could not load your profile. Check your internet connection and Firestore rules."
        );
    }
});

// 5. Save or update the profile

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !profileLoaded) {
        showMessage("Please wait until your profile finishes loading.");
        return;
    }

    const username = usernameInput.value.trim();
    const age = Number(ageInput.value);
    const gender = genderInput.value;

    const hobbies = Array.from(
        document.querySelectorAll('input[name="hobby"]:checked')
    ).map(input => input.value);

    // Validate the information.

    if (username.length < 2 || username.length > 30) {
        showMessage("Username must contain 2–30 characters.");
        usernameInput.focus();
        return;
    }

    if (!Number.isInteger(age) || age < 18 || age > 120) {
        showMessage("Age must be between 18 and 120.");
        ageInput.focus();
        return;
    }

    if (!gender) {
        showMessage("Please select your gender.");
        genderInput.focus();
        return;
    }

    if (hobbies.length === 0) {
        showMessage("Please select at least one hobby.");
        return;
    }

    saveButton.disabled = true;
    showMessage("Saving your profile...");

    try {
        const profileRef = doc(db, "users", currentUser.uid);

        // Preserve the original creation date when editing.
        const oldSnapshot = await getDoc(profileRef);
        const oldProfile = oldSnapshot.exists()
            ? oldSnapshot.data()
            : {};

        const profileData = {
            username: username,
            age: age,
            gender: gender,
            hobbies: hobbies,
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            createdAt: oldProfile.createdAt ||
                new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await setDoc(profileRef, profileData);

        showMessage("Profile saved successfully!");

        // Continue to the dashboard.
        window.location.replace("dashboard.html");

    } catch (error) {
        console.error("Profile saving error:", error);

        if (error.code === "permission-denied") {
            showMessage(
                "Permission denied. Check your Firestore security rules and field types."
            );
        } else {
            showMessage(
                "Could not save your profile. Please try again."
            );
        }

        saveButton.disabled = false;
    }
});

// 6. Log out

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.replace("login.html");
        } catch (error) {
            console.error("Logout error:", error);
            showMessage("Could not log out. Please try again.");
        }
    });
}
