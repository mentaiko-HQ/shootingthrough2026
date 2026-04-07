import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// 環境変数からFirebaseの設定を取得
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 開発時のデバッグ用：環境変数が読み込めているかのチェック
if (typeof window !== "undefined") {
  if (!firebaseConfig.projectId) {
    console.error("🚨 致命的なエラー: FirebaseのプロジェクトIDが設定されていません。");
    console.error("👉 プロジェクトのルートに .env.local ファイルを作成し、環境変数を設定してください。");
    console.error("👉 設定後、必ず開発サーバー（npm run dev）を再起動してください。");
  } else {
    console.log(`✅ Firebase設定読み込み成功: プロジェクトID = ${firebaseConfig.projectId}`);
  }
}

// 複数回初期化されるのを防ぐ（Next.jsのホットリロード対策）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };