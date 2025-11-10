// Paste your complete firebaseConfig object.
// CRITICAL: Replace the apiKey value with the NEW key you just generated.
const firebaseConfig = {
  apiKey: "AIzaSyDiFrGZLK1oCmz8JKkljMs_vVLZkv8Di1I", 
  authDomain: "eraokr-4d70a.firebaseapp.com",
  projectId: "eraokr-4d70a",
  storageBucket: "eraokr-4d70a.appspot.com",
  messagingSenderId: "78295398521",
  appId: "1:78295398521:web:ea3c7e8e9f7b8e247c7ca8",
  measurementId: "G-GMY1CXXY4E"
};

// Initialize Firebase using the v8 SDK syntax
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Conditionally initialize services only if they have been loaded
let auth;
if (typeof firebase.auth === 'function') {
    auth = firebase.auth();
}

let db;
if (typeof firebase.firestore === 'function') {
    db = firebase.firestore();
}
