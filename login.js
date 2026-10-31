
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// =====================================
// 1. FIREBASE CONFIGURATION
// =====================================

const firebaseConfig = {
    apiKey: "AIzaSyCqH5hMhWfkaDd4SbgNe2AZgTcqvXJ0RlM",
    authDomain: "yappo-1cff8.firebaseapp.com",
    projectId: "yappo-1cff8",
    storageBucket: "yappo-1cff8.firebasestorage.app",
    messagingSenderId: "721093115431",
    appId: "1:721093115431:web:cff66a07f3e224232bd802",
    measurementId: "G-L0B3QWPVVW"
};

// =====================================
// 2. INITIALIZE FIREBASE
// =====================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// =====================================
// 3. GET HTML ELEMENTS
// =====================================

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const rememberMe = document.getElementById("rememberMe");
const googleButton = document.getElementById("googleLogin");
const appleButton = document.getElementById("appleLogin");
const signupText = document.querySelector(".signup-text");
const forgotLink = document.getElementById("forgotPassword");
const authMessage = document.getElementById("authMessage");

const loginButton = loginForm.querySelector(
    'button[type="submit"]'
);

let isSignup = false;

// =====================================
// 4. DISPLAY MESSAGES
// =====================================

function showMessage(message) {
    authMessage.textContent = message;
}

function getFriendlyError(error) {
    const messages = {
        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/invalid-credential":
            "Incorrect email or password. Please try again.",

        "auth/user-not-found":
            "No account found. Please sign up first.",

        "auth/wrong-password":
            "Incorrect password. Please try again.",

        "auth/email-already-in-use":
            "This email is already registered. Please log in.",

        "auth/weak-password":
            "Your password is too weak. Choose a stronger one.",

        "auth/too-many-requests":
            "Too many attempts. Please try again later.",

        "auth/popup-closed-by-user":
            "The Google sign-in window was closed.",

        "auth/popup-blocked":
            "Your browser blocked the popup. Allow popups and try again.",

        "auth/unauthorized-domain":
            "This domain is not authorized in Firebase.",

        "auth/network-request-failed":
            "Network error. Check your internet connection.",

        "auth/operation-not-allowed":
            "This sign-in method is not enabled in Firebase.",

        "auth/invalid-api-key":
            "Firebase configuration is incorrect."
    };

    return messages[error.code] ||
        "Something went wrong. Please try again.";
}

// =====================================
// 5. CHOOSE PROFILE OR DASHBOARD
// =====================================

async function continueToNextPage(user) {
    showMessage("Checking your profile...");

    try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (profileSnapshot.exists()) {
            // Returning user with a saved profile.
            window.location.replace("dashboard.html");
        } else {
            // New user or account without a completed profile.
            window.location.replace("profile.html");
        }
    } catch (error) {
        console.error("Profile check error:", error);

        showMessage(
            "Signed in, but your profile could not be checked. " +
            "Check Firestore rules and try again."
        );
    }
}

// =====================================
// 6. EMAIL LOGIN AND SIGNUP
// =====================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage("");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!loginForm.reportValidity()) {
        return;
    }

    loginButton.disabled = true;
    googleButton.disabled = true;

    try {
        await setPersistence(
            auth,
            rememberMe.checked
                ? browserLocalPersistence
                : browserSessionPersistence
        );

        let userCredential;

        if (isSignup) {
            // Create a new email/password account.
            userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );
        } else {
            // Sign in an existing account.
            userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
        }

        await continueToNextPage(userCredential.user);

    } catch (error) {
        console.error("Email authentication error:", error);
        showMessage(getFriendlyError(error));
    } finally {
        loginButton.disabled = false;
        googleButton.disabled = false;
    }
});

// =====================================
// 7. SWITCH BETWEEN LOGIN AND SIGNUP
// =====================================

signupText.addEventListener("click", (event) => {
    const link = event.target.closest("a");

    if (!link || link.id !== "signupLink") {
        return;
    }

    event.preventDefault();
    isSignup = !isSignup;

    loginButton.textContent = isSignup
        ? "Create Account"
        : "Log In to Your Account";

    link.textContent = isSignup
        ? "Log in"
        : "Sign up";

    signupText.firstChild.textContent = isSignup
        ? "Already have an account? "
        : "Don't have an account yet? ";

    document.querySelector(".login-heading h1").textContent =
        isSignup
            ? "Create Your Account"
            : "Welcome to Yappo";

    document.querySelector(".login-heading p").textContent =
        isSignup
            ? "Create your account to start connecting"
            : "Enter your details below to resume chatting";

    passwordInput.autocomplete = isSignup
        ? "new-password"
        : "current-password";

    showMessage("");
});

// =====================================
// 8. GOOGLE SIGN-IN
// =====================================

googleButton.addEventListener("click", async () => {
    showMessage("");

    googleButton.disabled = true;
    loginButton.disabled = true;

    try {
        await setPersistence(
            auth,
            rememberMe.checked
                ? browserLocalPersistence
                : browserSessionPersistence
        );

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        console.log(
            "Google sign-in successful:",
            result.user.uid
        );

        await continueToNextPage(result.user);

    } catch (error) {
        console.error("Google sign-in error:", error);
        showMessage(getFriendlyError(error));
    } finally {
        googleButton.disabled = false;
        loginButton.disabled = false;
    }
});

// =====================================
// 9. FORGOT PASSWORD
// =====================================

forgotLink.addEventListener("click", async (event) => {
    event.preventDefault();

    showMessage("");

    const email = emailInput.value.trim();

    if (!email) {
        showMessage("Enter your email address first.");
        emailInput.focus();
        return;
    }

    forgotLink.style.pointerEvents = "none";

    try {
        await sendPasswordResetEmail(auth, email);

        showMessage(
            "If an account exists for this email, " +
            "you will receive a password reset email."
        );
    } catch (error) {
        console.error("Password reset error:", error);
        showMessage(getFriendlyError(error));
    } finally {
        forgotLink.style.pointerEvents = "";
    }
});

// =====================================
// 10. APPLE SIGN-IN
// =====================================

appleButton.addEventListener("click", () => {
    showMessage(
        "Apple sign-in is not configured yet. " +
        "Please use email or Google sign-in."
    );
});

console.log("Yappo login script loaded successfully.");
