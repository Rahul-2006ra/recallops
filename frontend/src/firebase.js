import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA25lID4ZQMnm8kRuGIUaNje8MoMOZ-xZ0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "recallops-181ad.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "recallops-181ad",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "recallops-181ad.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "653299111774",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:653299111774:web:66e09b53540e78e1c5e1cf",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-QJ6LJSHPMP",
};

// Initialize Firebase idempotently
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  app,
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
};
