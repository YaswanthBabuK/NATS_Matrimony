/**
 * firebase.js — Firebase initialisation for NATS Matrimony (web).
 *
 * Exports the `auth` instance and every Auth helper the app needs.
 * No google-services.json required — that file is only for Android/iOS apps.
 * The config below comes straight from Firebase Console → Project Settings → Web app.
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// ── Project config (from Firebase Console → Project Settings → Web app) ───────
const firebaseConfig = {
  apiKey:            "AIzaSyD6rv69a-Wiy8mVuGm11Djl44rVy-QgNm4",
  authDomain:        "nats-matrimony.firebaseapp.com",
  projectId:         "nats-matrimony",
  storageBucket:     "nats-matrimony.firebasestorage.app",
  messagingSenderId: "966253579037",
  appId:             "1:966253579037:web:f2359b3c798174773eeff4",
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Re-export helpers so pages import from a single place
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};
