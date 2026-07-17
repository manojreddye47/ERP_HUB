import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdrT97GXYoA7LNr5f39uRHuyNCeGfSJa4",
  authDomain: "waretrack-86cf0.firebaseapp.com",
  projectId: "waretrack-86cf0",
  storageBucket: "waretrack-86cf0.firebasestorage.app",
  messagingSenderId: "298683388454",
  appId: "1:298683388454:web:6f2c561dc0029a3ea64ce7",
  measurementId: "G-2GHTTSJ44E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db: Firestore = getFirestore(app);

// Enable persistence asynchronously (safer than synchronous configuration)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore offline cache disabled: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore offline cache disabled: IndexedDB not supported by browser.");
    } else {
      console.warn("Firestore offline cache error:", err.message);
    }
  });
}

export { app, auth, db };
