


'use server';

import { getAppSettings, saveAppSettings } from './settingsService';
import { addTransaction } from './transactionService';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { SmsSyncLog, SmsProcessingResult, Transaction, AutoTransactionRule } from '@/types';
import Papa from 'papaparse';


interface SheetRow {
  date: string;
  name: string;
  message: string;
}

// Function to extract the first number after a keyword.
function extractAmountAfterKeyword(keyword: string, message: string): number | null {
  if (!keyword || !message) return null;
  
  // This regex handles commas in numbers and optional decimal parts.
  const regex = new RegExp(`${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d,]+\\.?\\d*)`, 'i');
  const match = message.match(regex);

  if (match && match[1]) {
    const numericValue = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(numericValue)) {
      return numericValue;
    }
  }

  return null;
}


export async function fetchSheetData(): Promise<SheetRow[]> {
  const settings = await getAppSettings();
  const sheetId = settings?.googleSheetId;

  if (!sheetId) {
    console.log("Google Sheet ID not configured in settings. Skipping fetch.");
    return [];
  }
  
  const publishedCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

  try {
    const response = await fetch(`${publishedCsvUrl}&t=${new Date().getTime()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data. Status: ${response.status}. Please ensure the sheet is published to the web as a CSV.`);
    }
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.toLowerCase().trim(),
            complete: (results) => {
                const mappedData = results.data.map((row: any) => ({
                    date: row.timestamp || '',
                    name: (row.sender || '').trim().replace(/"/g, ''),
                    message: row.message || ''
                })).filter(row => row.date && row.name && row.message);
                resolve(mappedData);
            },
            error: (error: any) => {
                reject(new Error(`CSV Parsing Error: ${error.message}`));
            }
        });
    });

  } catch (error) {
    console.error("Error fetching Google Sheet:", error);
    throw new Error('Could not fetch or parse data from the Google Sheet. Please check the sheet publishing settings and format.');
  }
}

export async function processSmsAndCreateTransactions(): Promise<SmsSyncLog> {
  if (!db) {
    const errorLog = { date: new Date().toISOString(), created: 0, skipped: 0, errors: 1, results: [{ status: 'error', reason: 'Firebase not configured', sms: { name: 'System', message: 'DB init failed', date: new Date().toISOString() }}]};
    return errorLog;
  }
  
  const settings = await getAppSettings();
  const processingResults: SmsProcessingResult[] = [];
  
  if (!settings || !settings.autoTransactionRules || settings.autoTransactionRules.length === 0) {
    const log: SmsSyncLog = { date: new Date().toISOString(), created: 0, skipped: 0, errors: 0, results: [] };
    await saveAppSettings({...settings!, lastSyncResult: log});
    return log;
  }

  const sheetData = await fetchSheetData();
  const transactionsCollectionRef = collection(db, 'transactions');
  
  for (const row of sheetData) {
      let transactionCreated = false;

      // Find the first rule that can successfully extract an amount
      for (const rule of settings.autoTransactionRules) {
          if (!rule.enabled) continue;

          const senderMatch = row.name.toLowerCase().includes(rule.senderIdentifier.toLowerCase());
          if (!senderMatch) continue;

          const message = row.message;
          const requiredKeywords = (rule.messageFilter || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
          const allKeywordsMatch = requiredKeywords.every(keyword => message.toLowerCase().includes(keyword));

          if (requiredKeywords.length > 0 && !allKeywordsMatch) continue;
          
          const amount = rule.amountKeyword ? extractAmountAfterKeyword(rule.amountKeyword, message) : null;
          
          // This is the crucial change: only proceed if amount is valid
          if (amount !== null && !isNaN(amount) && amount > 0) {
              const uniqueSmsId = `sms-${row.date.replace(/[^0-9]/g, '')}-${row.name}-${rule.id}`;
              const q = query(transactionsCollectionRef, where("autoTransactionRuleId", "==", uniqueSmsId), limit(1));
              const existing = await getDocs(q);

              if (existing.empty) {
                  try {
                      const txData: Omit<Transaction, 'id' | 'enabled'> = {
                          date: new Date().toISOString().split('T')[0],
                          description: `Auto from SMS: ${row.name}`,
                          amount: amount,
                          type: rule.transactionType,
                          accountId: rule.accountId,
                          partyId: rule.partyId || undefined,
                          via: rule.via || undefined,
                          autoTransactionRuleId: uniqueSmsId,
                      };
                      await addTransaction(txData);
                      processingResults.push({ status: 'success', transaction: txData, sms: { name: row.name, message: row.message, date: row.date }, ruleName: rule.name, amount: amount });
                      transactionCreated = true;
                  } catch (error: any) {
                      processingResults.push({ status: 'error', reason: error.message, sms: { name: row.name, message: row.message, date: row.date }, ruleName: rule.name, amount });
                  }
              } else {
                  // Already processed, so we can consider it "done" for this SMS row
                  transactionCreated = true;
              }

              // Once a transaction is successfully created (or found to exist), we stop checking other rules for this SMS.
              break; 
          }
      }

      if (!transactionCreated) {
          processingResults.push({ status: 'skipped', reason: 'No matching rule could extract a valid amount.', sms: { name: row.name, message: row.message, date: row.date } });
      }
  }
  
  const finalLog: SmsSyncLog = {
      date: new Date().toISOString(),
      created: processingResults.filter(r => r.status === 'success').length,
      skipped: processingResults.filter(r => r.status === 'skipped').length,
      errors: processingResults.filter(r => r.status === 'error').length,
      results: processingResults.sort((a,b) => new Date(b.sms.date).getTime() - new Date(a.sms.date).getTime())
  };
  
  await saveAppSettings({...settings, lastSyncResult: finalLog});
  
  return finalLog;
}
