

'use server';

import { getDatabase, ref, push, set, serverTimestamp } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { AppSettings } from '@/types';
import { getAppSettings } from './settingsService';


// This function needs to handle the case where the client-side 'db' (Firestore) might be different
// from the Realtime Database instance we need here.
function getRealtimeDB() {
    return rtdb;
}

export async function sendSmsViaFirebase(to: string, message: string): Promise<void> {
  const db = getRealtimeDB();
  if (!db) {
    throw new Error("Firebase Realtime Database is not configured. Check your firebaseConfig in lib/firebase.ts.");
  }

  try {
    const smsQueueRef = ref(db, 'smsQueue');
    const newSmsRef = push(smsQueueRef);
    await set(newSmsRef, {
      to: to,
      message: message,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    console.log(`SMS to ${to} queued successfully in Firebase RTDB.`);
  } catch (error) {
    console.error("Failed to queue SMS in Firebase RTDB:", error);
    if (error instanceof Error) {
        throw new Error(`Could not queue SMS. Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while trying to queue the SMS.");
  }
}

export async function sendSmsViaWebhook(webhookUrl: string, apiKey: string, to: string, message: string): Promise<void> {
  if (!webhookUrl) {
    throw new Error("SMS Webhook URL is not configured.");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        phone: to,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Webhook failed with status ${response.status}: ${errorData.message}`);
    }

    console.log(`SMS to ${to} queued successfully via Webhook.`);
  } catch (error) {
    console.error("Failed to queue SMS via Webhook:", error);
    if (error instanceof Error) {
        throw new Error(`Could not queue SMS via Webhook. Please check your setup. Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while trying to queue the SMS via Webhook.");
  }
}
