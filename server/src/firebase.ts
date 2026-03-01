import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;

if (projectId) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (privateKey && clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Use Application Default Credentials (e.g., when deployed on GCP)
    admin.initializeApp({ projectId });
  }
} else {
  console.warn('FIREBASE_PROJECT_ID not set — auth verification disabled');
}

export const firebaseAdmin = projectId ? admin : null;

export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
  if (!firebaseAdmin) return null;
  try {
    return await firebaseAdmin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}
