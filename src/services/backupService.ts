'use client';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc, setDoc } from 'firebase/firestore';

// All collections used in the application
const COLLECTIONS = [
  'transactions', 'parties', 'accounts', 'inventory', 'inventoryCategories',
  'inventoryMovements', 'settings', 'planProjects', 'planEntries', 'notes', 
  'reminders', 'old_data_ledgers', 'custom_statements', 'truck_gift_records', 
  'tasks', 'quotations', 'audits', 'profit_projects', 'electricityMeters',
  'manual_invoices', 'chats', 'warisan_certificates', 'trade_licences',
  'tours', 'sms_logs', 'log_records', 'eliteClubMembers',
  'family_registrations', 'fitness_logs', 'newsCategories'
];

/**
 * Fetches all data from all defined collections
 */
export async function getAllData(): Promise<Record<string, any[]>> {
  if (!db) throw new Error('Firebase not configured');
  
  const backup: Record<string, any[]> = {};
  
  for (const colName of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      backup[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn(`Could not backup collection ${colName}:`, e);
      backup[colName] = [];
    }
  }
  
  return backup;
}

/**
 * Deletes existing data and restores from the provided backup object
 */
export async function restoreAllData(backup: Record<string, any[]>) {
  if (!db) throw new Error('Firebase not configured');

  // 1. Delete all current data in target collections
  for (const colName of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      let batch = writeBatch(db);
      let count = 0;
      
      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn(`Could not clear collection ${colName}:`, e);
    }
  }

  // 2. Write backup data
  for (const colName in backup) {
    const items = backup[colName];
    if (!Array.isArray(items) || items.length === 0) continue;
    
    let batch = writeBatch(db);
    let count = 0;
    
    for (const item of items) {
      const { id, ...data } = item;
      if (!id) continue;
      
      const docRef = doc(db, colName, id);
      batch.set(docRef, data);
      count++;
      
      if (count === 450) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }
}
