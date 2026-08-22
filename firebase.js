import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyD60h8U6D8gdzW4_-oCHnjHbc85aNflNmg",
    authDomain: "attendly-5bb6f.firebaseapp.com",
    databaseURL: "https://attendly-5bb6f-default-rtdb.firebaseio.com/",
    projectId: "attendly-5bb6f",
    storageBucket: "attendly-5bb6f.firebasestorage.app",
    messagingSenderId: "536516052846",
    appId: "1:536516052846:web:66368776eda9c8dd2ea37f"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

export { db };