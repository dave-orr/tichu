# Tichu Project Notes

## Site

Production site: https://tichu.squidbox.com

## Environment Files

### server/.env
Contains Firebase Admin SDK credentials (`FIREBASE_PRIVATE_KEY`, etc.). **This file is git-ignored and must never be committed.** It is not present in the repository. See `server/.env.example` for the required keys, and obtain the actual values from the Firebase console (Project Settings > Service Accounts).
