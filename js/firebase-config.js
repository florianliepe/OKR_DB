const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with your actual apiKey
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // Replace with your actual authDomain
  projectId: "YOUR_PROJECT_ID", // Replace with your actual projectId
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // Replace with your actual storageBucket
  messagingSenderId: "YOUR_SENDER_ID", // Replace with your actual messagingSenderId
  appId: "YOUR_APP_ID" // Replace with your actual appId
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
