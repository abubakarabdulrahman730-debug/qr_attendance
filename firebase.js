import { initializeApp } from "firebase/app";
<<<<<<< HEAD
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
=======
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD60h8U6D8gdzW4_-oCHnjHbc85aNflNmg",
  authDomain: "attendly-5bb6f.firebaseapp.com",
  projectId: "attendly-5bb6f",
  storageBucket: "attendly-5bb6f.firebasestorage.app",
  messagingSenderId: "536516052846",
  appId: "1:536516052846:web:66368776eda9c8dd2ea37f"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
>>>>>>> 895c4319261db92b8ee105a43855686f89294661

export { db };