// js/firebase-config.js

// Import functions from the Firebase CDN directly
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzq5zilwhPbo_18iJ3rZlHh_pGMGHcRwU",
    authDomain: "eraokr-4d70a.firebaseapp.com",
    projectId: "eraokr-4d70a",
    storageBucket: "eraokr-4d70a.appspot.com",
    messagingSenderId: "78295398521",
    appId: "1:78295398521:web:ea3c7e8e9f7b8e247c7ca8",
    measurementId: "G-GMY1CXXY4E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get and export the services
export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app);

// Export a callable function reference to our deployed backend function
export const askOkrWizard = httpsCallable(functions, 'askOkrWizard');
