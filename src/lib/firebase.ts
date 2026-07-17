import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Firebase web config for the "squadcalc" project. The apiKey is not a secret —
// it identifies the project client-side; access is governed by the RTDB rules.
const firebaseConfig = {
  apiKey: "AIzaSyAlDZNGJaAYk_zijqdGRN2g8SBCbJqkRgk",
  authDomain: "squadcalc.firebaseapp.com",
  databaseURL: "https://squadcalc-default-rtdb.firebaseio.com",
  projectId: "squadcalc",
  storageBucket: "squadcalc.firebasestorage.app",
  messagingSenderId: "915287450173",
  appId: "1:915287450173:web:d215ad42a323ae883ec054",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
