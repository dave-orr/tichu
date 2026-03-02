# Tichu Project Notes

## Environment Files

### client/.env
Contains Firebase client-side config (`VITE_FIREBASE_*` variables). These values are safe to commit — they are embedded in the browser bundle anyway and are designed to be public. See `client/.env.example` for the required keys.

### server/.env
Contains Firebase Admin SDK credentials (`FIREBASE_PRIVATE_KEY`, etc.). **This file is git-ignored and must never be committed.** It is not present in the repository. See `server/.env.example` for the required keys, and obtain the actual values from the Firebase console (Project Settings > Service Accounts).
