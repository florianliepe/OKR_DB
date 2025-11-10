const firebaseConfig = {
  apiKey: "AIzaSyC26f3QvnPD9F0_l_BNBdrGOvwICq86t1g",
  authDomain: "eraokr-4d70a.firebaseapp.com",
  projectId: "eraokr-4d70a",
  storageBucket: "eraokr-4d70a.appspot.com",
  messagingSenderId: "78295398521",
  appId: "1:78295398521:web:ea3c7e8e9f7b8e247c7ca8",
  measurementId: "G-GMY1CXXY4E"
};

// Initialize Firebase using the v8 SDK syntax
firebase.initializeApp(firebaseConfig);

// Correctly get the Auth and Firestore services for the v8 SDK
const auth = firebase.auth();
const db = firebase.firestore();
