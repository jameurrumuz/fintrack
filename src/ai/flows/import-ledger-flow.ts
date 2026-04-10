
'use server';

/**
 * @fileOverview An AI agent that parses ledger text into structured transaction data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ImportLedgerInputSchema = z.object({
  ledgerText: z.string().describe('The full text content of a party ledger.'),
});
export type ImportLedgerInput = z.infer<typeof ImportLedgerInputSchema>;

const ParsedTransactionSchema = z.object({
    date: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
    type: z.string().describe("The type of transaction, e.g., 'Credit Sale', 'Payment Taken', 'Sale'."),
    comments: z.string().describe("The full comment or description for the transaction."),
    debit: z.number().describe("The debit amount (I Gave / due to me). 0 if not applicable."),
    credit: z.number().describe("The credit amount (I Receive / due to him). 0 if not applicable."),
    balance: z.number().describe("The running balance after the transaction."),
});

const ImportLedgerOutputSchema = z.object({
  transactions: z.array(ParsedTransactionSchema).describe('An array of parsed transactions from the ledger text.'),
});
export type ImportLedgerOutput = z.infer<typeof ImportLedgerOutputSchema>;

export async function importLedger(input: ImportLedgerInput): Promise<ImportLedgerOutput> {
  return importLedgerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'importLedgerPrompt',
  input: { schema: ImportLedgerInputSchema },
  output: { schema: ImportLedgerOutputSchema },
  prompt: `You are an expert data entry specialist. Your task is to parse the following ledger text and extract all transaction rows.
- Ignore the header, summary, and footer. Only focus on the numbered transaction lines starting from "SNo".
- Convert all dates to a standard YYYY-MM-DD format. For example, '07 Mar 2023' should become '2023-03-07'.
- Ensure that the debit, credit, and balance fields are numbers. If a value is not present, use 0.
- The 'type' column from the PDF should map to the 'type' field in the output.
- The 'Comments' column from the PDF should map to the 'comments' field in the output.
- The 'I Gave / due to me (৳)' column from the PDF should map to the 'debit' field.
- The 'I Receive / due to him (৳)' column from the PDF should map to the 'credit' field.
- The 'Balance (৳)' column should map to the 'balance' field.

Ledger Text:
{{{ledgerText}}}

Parse the transaction lines and provide the output in the specified JSON format.
`,
});

const importLedgerFlow = ai.defineFlow(
  {
    name: 'importLedgerFlow',
    inputSchema: ImportLedgerInputSchema,
    outputSchema: ImportLedgerOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
