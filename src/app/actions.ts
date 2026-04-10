
'use server';

import { categorizeTransaction as categorizeTransactionFlow, CategorizeTransactionInput } from '@/ai/flows/categorize-transaction';
import { importLedger as importLedgerFlow, ImportLedgerInput } from '@/ai/flows/import-ledger-flow';

export async function suggestCategories(input: CategorizeTransactionInput) {
  if (!input.description || input.amount === undefined || !input.paymentMethod) {
    return { error: 'Description, amount, and payment method are required.' };
  }

  try {
    const result = await categorizeTransactionFlow(input);
    return { suggestions: result.categorySuggestions };
  } catch (error) {
    console.error('Error suggesting categories:', error);
    return { error: 'Failed to suggest categories. Please try again.' };
  }
}

export async function importLedger(input: ImportLedgerInput) {
    if (!input.ledgerText) {
        return { error: 'Ledger text is required.' };
    }

    try {
        const result = await importLedgerFlow(input);
        return { transactions: result.transactions };
    } catch (error) {
        console.error('Error importing ledger:', error);
        return { error: 'Failed to parse ledger data. Please check the format.' };
    }
}
