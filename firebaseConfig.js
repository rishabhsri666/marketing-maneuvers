import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDaUE_A6bBveGTrKmNMQlDNqEMxJWtZp20",
  authDomain: "marketing-maneuvers.firebaseapp.com",
  projectId: "marketing-maneuvers",
  storageBucket: "marketing-maneuvers.firebasestorage.app",
  messagingSenderId: "590172374253",
  appId: "1:590172374253:web:5b59a39524eda56aabb8e4"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);