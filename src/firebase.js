import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAio8fc02a0o9eDqh_GSq17RaMsuyqGKTI",
  authDomain: "ramidemia18.firebaseapp.com",
  projectId: "ramidemia18",
  storageBucket: "ramidemia18.firebasestorage.app",
  messagingSenderId: "62684337366",
  appId: "1:62684337366:web:b6c0a444d0e7e574a22577",
  measurementId: "G-5MK3DB0FSM",
};

const app = initializeApp(firebaseConfig);

getAnalytics(app);

export const db = getFirestore(app);
export const storage = getStorage(app);