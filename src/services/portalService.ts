

'use client';

import { db } from '@/lib/firebase';
import { Party, ActivityLog } from '@/types';
import { collection, addDoc, doc, where, query, getDocs, limit, onSnapshot, Unsubscribe, updateDoc, getDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

const getPartiesCollection = () => {
    if (!db) return null;
    return collection(db, 'parties');
}

// Check if a party exists with the given phone number
export async function checkPartyExists(phone: string): Promise<{ exists: boolean; error?: string }> {
  const partiesCollection = getPartiesCollection();
  if (!partiesCollection) {
    return { exists: false, error: 'Database service is not available.' };
  }
  try {
    const q = query(partiesCollection, where("phone", "==", phone), limit(1));
    const existing = await getDocs(q);
    return { exists: !existing.empty };
  } catch (error) {
    console.error("Error checking for party:", error);
    return { exists: false, error: 'Could not perform check.' };
  }
}

// --- Admin ---
const ADMIN_PHONE = '01617590765';
const ADMIN_PASSWORD = 'lmh#01617';

export async function authenticateAdmin(phone: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (phone === ADMIN_PHONE && password === ADMIN_PASSWORD) {
    return { success: true };
  }
  return { success: false };
}

// --- Party / User ---

export async function createPartyAccount(
  data: Pick<Party, 'name' | 'phone' | 'password' | 'address' | 'servicePackage'>
): Promise<{ success: boolean; error?: string }> {
  const partiesCollection = getPartiesCollection();
  if (!partiesCollection) {
    return { success: false, error: 'Database service is not available.' };
  }

  // Check if phone number already exists
  const q = query(partiesCollection, where("phone", "==", data.phone), limit(1));
  const existing = await getDocs(q);
  if (!existing.empty) {
    return { success: false, error: 'A user with this phone number already exists. Please contact 01617590765 for assistance.' };
  }

  const newParty: Omit<Party, 'id'> = {
    name: data.name,
    phone: data.phone,
    password: data.password,
    address: data.address,
    servicePackage: data.servicePackage,
    partyType: 'Customer', // Default to customer
    permissions: { viewLedger: true }, // Give default permission to view ledger
    lastContacted: new Date().toISOString(),
  };

  try {
    await addDoc(partiesCollection, {
        ...newParty,
        lastContacted: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error creating party account:", error);
    return { success: false, error: 'Could not create account.' };
  }
}

export async function logActivity(partyId: string, action: ActivityLog['action'], details?: ActivityLog['details']) {
    if (!db) return;
    try {
        const partyRef = doc(db, 'parties', partyId);
        
        const newLogEntry: Partial<ActivityLog> = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action,
        };

        if (details) {
            newLogEntry.details = details;
        }

        await updateDoc(partyRef, {
            activity: arrayUnion(newLogEntry),
            lastSeen: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}


export async function authenticateParty(phone: string, password: string): Promise<{ success: boolean; partyId?: string; party?: Party; error?: string }> {
    const partiesCollection = getPartiesCollection();
    if (!partiesCollection) {
        return { success: false, error: 'Database service is not available.' };
    }

    const q = query(partiesCollection, where("phone", "==", phone), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return { success: false, error: "No account found with this phone number." };
    }

    const partyDoc = snapshot.docs[0];
    const partyData = { id: partyDoc.id, ...partyDoc.data() } as Party;
    
    const loginSuccess = async (partyToUpdate: Party) => {
        await logActivity(partyToUpdate.id, 'login');
        const updatedPartyData = { ...partyToUpdate, lastSeen: new Date().toISOString() };
        return { success: true, partyId: partyToUpdate.id, party: updatedPartyData };
    };

    // If password field doesn't exist or is empty, use phone number as default password
    if (!partyData.password || partyData.password.trim() === '') {
        if (password === partyData.phone) {
            return await loginSuccess(partyData);
        }
    }

    if (partyData.password === password) {
         return await loginSuccess(partyData);
    } else {
        return { success: false, error: "Incorrect password." };
    }
}

export async function updatePartyPassword(partyId: string, currentPass: string, newPass: string): Promise<void> {
    if (!db) throw new Error("Firebase is not configured.");
    const partyRef = doc(db, 'parties', partyId);
    const partySnap = await getDoc(partyRef);

    if (!partySnap.exists()) throw new Error("User not found.");

    const party = partySnap.data() as Party;
    
    // Check current password (including default phone password logic)
    const isCurrentPasswordCorrect = (party.password && party.password === currentPass) || (!party.password && party.phone === currentPass);
    
    if (!isCurrentPasswordCorrect) {
        throw new Error("Your current password is not correct.");
    }
    
    await updateDoc(partyRef, { password: newPass });
}

export async function requestNameChange(partyId: string, newName: string): Promise<void> {
    if (!db) throw new Error("Firebase is not configured.");
    const partyRef = doc(db, 'parties', partyId);
    await updateDoc(partyRef, { pendingNameChange: newName });
}


export function subscribeToPartyById(
  id: string,
  onUpdate: (party: Party | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!db) {
    onError(new Error('Firebase is not configured.'));
    return () => {};
  }
  const partyRef = doc(db, 'parties', id);
  
  const unsubscribe = onSnapshot(partyRef, (docSnap) => {
    if (docSnap.exists()) {
       const data = docSnap.data();
       const party = { 
          id: docSnap.id, 
          ...data,
          lastSeen: (data.lastSeen as any)?.toDate ? (data.lastSeen as any).toDate().toISOString() : data.lastSeen,
          activity: (data.activity || []).map((log: any) => ({
              ...log,
              timestamp: (log.timestamp as any)?.toDate ? (log.timestamp as any).toDate().toISOString() : log.timestamp,
          })),
        } as Party;
      onUpdate(party);
    } else {
      onUpdate(null);
    }
  }, (error) => {
    console.error(`Error listening to party ${id}:`, error);
    onError(error);
  });

  return unsubscribe;
}
