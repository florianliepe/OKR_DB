const firebaseConfig = {
  apiKey: "AIzaSyC26f3QvnPD9FO_l_BNBdrGOvwICq86t1g",
  authDomain: "eraokr-4d70a.firebaseapp.com",
  projectId: "eraokr-4d70a",
  storageBucket: "eraokr-4d70a.firebasestorage.app",
  messagingSenderId: "78295398521",
  appId: "1:78295398521:web:ea3c7e8e9f7b8e247c7ca8",
  measurementId: "G-GMY1CXXY4E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = firebase.auth();
const db = firebase.firestore();
