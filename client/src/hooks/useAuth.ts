import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfigured } from '../firebase.js';
import type { GameSettings } from '@tichu/shared';

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  stats: UserStats;
  preferences: UserPreferences;
};

export type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWonFirstOut: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  doubleVictories: number;
  totalPointDifferential: number;
  bombsPlayed: number;
  bombsFaced: number;
  closeGameWins: number;
  closeGamesPlayed: number;
  comebackWins: number;
  comebackOpportunities: number;
  tichuCallsWhenBehind: number;
  tichuCallsWhenAhead: number;
  grandCallsWhenBehind: number;
  grandCallsWhenAhead: number;
};

export type UserPreferences = {
  preferredName: string;
  lastSettings?: Partial<GameSettings>;
};

const DEFAULT_STATS: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWonFirstOut: 0,
  tichuCalls: 0,
  tichuSuccesses: 0,
  grandTichuCalls: 0,
  grandTichuSuccesses: 0,
  doubleVictories: 0,
  totalPointDifferential: 0,
  bombsPlayed: 0,
  bombsFaced: 0,
  closeGameWins: 0,
  closeGamesPlayed: 0,
  comebackWins: 0,
  comebackOpportunities: 0,
  tichuCallsWhenBehind: 0,
  tichuCallsWhenAhead: 0,
  grandCallsWhenBehind: 0,
  grandCallsWhenAhead: 0,
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        try {
          const userProfile = await loadOrCreateProfile(firebaseUser);
          setProfile(userProfile);
        } catch (error) {
          console.error('Failed to load/create user profile:', error);
          // Fall back to a minimal profile from the Firebase user
          setProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Player',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL,
            stats: { ...DEFAULT_STATS },
            preferences: {
              preferredName: firebaseUser.displayName?.split(' ')[0] || 'Player',
            },
          });
        }
      } else {
        setIdToken(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Refresh token periodically (tokens expire after 1 hour)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const token = await user.getIdToken(true);
      setIdToken(token);
    }, 50 * 60 * 1000); // refresh every 50 minutes
    return () => clearInterval(interval);
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase not configured — set VITE_FIREBASE_* env vars');
      return null;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setIdToken(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const userProfile = await loadOrCreateProfile(user);
    setProfile(userProfile);
  }, [user]);

  const saveLastSettings = useCallback(async (settings: Partial<GameSettings>) => {
    if (!user || !db) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, { preferences: { lastSettings: settings } }, { merge: true });
    setProfile(prev => prev ? { ...prev, preferences: { ...prev.preferences, lastSettings: settings } } : prev);
  }, [user]);

  return {
    user,
    profile,
    loading,
    idToken,
    signInWithGoogle,
    signOut,
    refreshProfile,
    saveLastSettings,
  };
}

async function loadOrCreateProfile(user: User): Promise<UserProfile> {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, 'users', user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Update display info on each login
    const updated: Partial<UserProfile> = {
      displayName: user.displayName || data.displayName,
      email: user.email || data.email,
      photoURL: user.photoURL,
    };
    await setDoc(docRef, updated, { merge: true });
    return {
      uid: user.uid,
      displayName: data.displayName || user.displayName || 'Player',
      email: data.email || user.email || '',
      photoURL: user.photoURL,
      stats: { ...DEFAULT_STATS, ...data.stats },
      preferences: {
        preferredName: data.preferences?.preferredName || user.displayName?.split(' ')[0] || 'Player',
        lastSettings: data.preferences?.lastSettings,
      },
    };
  }

  // New user — create profile
  const newProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Player',
    email: user.email || '',
    photoURL: user.photoURL,
    stats: { ...DEFAULT_STATS },
    preferences: {
      preferredName: user.displayName?.split(' ')[0] || 'Player',
    },
  };

  await setDoc(docRef, {
    displayName: newProfile.displayName,
    email: newProfile.email,
    photoURL: newProfile.photoURL,
    stats: newProfile.stats,
    preferences: newProfile.preferences,
    createdAt: new Date().toISOString(),
  });

  return newProfile;
}
