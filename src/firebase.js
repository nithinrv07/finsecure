// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgghfDrIgNbSQVyzBqq-QQc7qwzd6LWz0",
  authDomain: "fin-740ab.firebaseapp.com",
  databaseURL: "https://fin-740ab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fin-740ab",
  storageBucket: "fin-740ab.firebasestorage.app",
  messagingSenderId: "661508400661",
  appId: "1:661508400661:web:27d8c9f14add9014ce101c",
  measurementId: "G-P8YQ2ZD574"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Analytics may fail in non-browser environments; ignore silently
}

export { app, analytics, auth, db };
