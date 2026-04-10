
import { config } from 'dotenv';
config();

import '@/ai/flows/categorize-transaction.ts';
import '@/ai/flows/import-ledger-flow.ts';
import '@/ai/flows/extract-pdf-flow.ts';
