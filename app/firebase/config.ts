// Firebase配置文件
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFirebaseConfig } from '../utils/env';

// 获取Firebase配置
const firebaseConfig = getFirebaseConfig();

// 初始化Firebase（避免重复初始化）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db }; 