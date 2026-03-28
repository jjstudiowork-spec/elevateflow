// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBpY8_6kxKSQV9QWmP8k2gqXWGo5cAGHvI",
  authDomain: "elevateflow-sync.firebaseapp.com",
  projectId: "elevateflow-sync",
  storageBucket: "elevateflow-sync.firebasestorage.app",
  messagingSenderId: "7030506040",
  appId: "1:7030506040:web:cfcefe4d4e69c33c951ccd",
  measurementId: "G-RSHR44YPBB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);