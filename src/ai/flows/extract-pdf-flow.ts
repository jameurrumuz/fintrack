'use server';
/**
 * @fileOverview A flow for extracting structured data from a PDF file.
 *
 * - extractDataFromPdf - A function that handles the PDF data extraction process.
 * - ExtractPdfInput - The input type for the extractDataFromPdf function.
 * - ExtractPdfOutput - The return type for the extractDataFromPdf function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  startRow: z.number().optional().describe('The starting row number for data extraction.'),
  endRow: z.number().optional().describe('The ending row number for data extraction.'),
});
export type ExtractPdfInput = z.infer<typeof ExtractPdfInputSchema>;

// Define a flexible output type since the structure can vary.
export type ExtractPdfOutput = {
  data: Record<string, string | number>[];
};

export async function extractDataFromPdf(input: ExtractPdfInput): Promise<ExtractPdfOutput> {
  return extractPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: { schema: ExtractPdfInputSchema },
  // We remove the output schema here to allow for more flexible JSON output from the model.
  prompt: `You are an expert at extracting tabular data from PDF documents.
Your task is to analyze the provided PDF file and extract the main table into a structured format.

- The PDF contains a main data table. You MUST find this table.
- The columns to extract are: 'Date', 'Type', 'Comments', 'I Gave / due to me (৳)', 'I Receive / due to him (৳)', and 'Balance (৳)'.
- It is critical that you extract every single data row, from the first to the very last one. Do not miss any rows. Do not stop processing mid-way through the document.
- Use the exact column headers provided above as JSON keys. The keys must be in English as specified.
- Rename 'I Gave / due to me (৳)' to 'debit' and 'I Receive / due to him (৳)' to 'credit'.
- The final output MUST be a JSON object with a single key "data", which is an array of JSON objects.
- Each object in the "data" array represents a row from the table.
- Ignore headers, footers, and summary information outside of the main table.
- If a value in a cell is not present, use an empty string or 0 for numeric fields.
{{#if startRow}}
- IMPORTANT: Start extracting data from serial number (SNo) {{{startRow}}}.
{{/if}}
{{#if endRow}}
- IMPORTANT: Stop extracting data after serial number (SNo) {{{endRow}}}.
{{/if}}

PDF File to process: {{media url=pdfDataUri}}`,
});

const extractPdfFlow = ai.defineFlow(
  {
    name: 'extractPdfFlow',
    inputSchema: ExtractPdfInputSchema,
    // The output is now of type 'any' since we are parsing it manually.
    outputSchema: z.any(),
  },
  async (input) => {
    const { output } = await prompt(input);

    try {
      // The model might return a string that needs to be parsed, or an object directly.
      let parsedOutput;
      if (typeof output === 'string') {
        // Clean the string to remove markdown code block fences if they exist.
        const cleanedString = output.replace(/^```json\s*|```$/g, '');
        parsedOutput = JSON.parse(cleanedString);
      } else {
        parsedOutput = output;
      }
      
      // Validate the structure of the parsed output.
      if (parsedOutput && parsedOutput.data && Array.isArray(parsedOutput.data)) {
        return { data: parsedOutput.data };
      }

      console.error("Model did not return the expected data structure.", output);
      return { data: [{ "error": "The model returned an unexpected data structure." }] };

    } catch (e) {
      console.error("Failed to parse JSON output from the model.", e, "Raw output:", output);
      return { data: [{ "error": "Could not process the content of the PDF. It might be an image-only PDF or have a very complex layout." }] };
    }
  }
);
