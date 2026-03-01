import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase.js';

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
};

export type UserPreferences = {
  preferredName: string;
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
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        const userProfile = await loadOrCreateProfile(firebaseUser);
        setProfile(userProfile);
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
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setIdToken(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const userProfile = await loadOrCreateProfile(user);
    setProfile(userProfile);
  }, [user]);

  return {
    user,
    profile,
    loading,
    idToken,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };
}

async function loadOrCreateProfile(user: User): Promise<UserProfile> {
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
