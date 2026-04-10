import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("FIREBASE_PRIVATE_KEY environment variable is not set.");
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.message);
  }
}

export async function POST(request: Request) {
  try {
    const { token, title, body } = await request.json();

    if (!token || !title || !body) {
      return NextResponse.json({ success: false, error: 'Missing token, title, or body' }, { status: 400 });
    }
    
    if (admin.apps.length === 0) {
        throw new Error("Firebase Admin SDK is not initialized. Check server logs for initialization errors.");
    }


    const message = {
      notification: {
        title: title,
        body: body,
      },
      token: token,
    };

    // Send the message using the Firebase Admin SDK
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);

    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    console.error('Error sending FCM message:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
