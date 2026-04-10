
'use server';

import fs from 'fs';
import path from 'path';

/**
 * Server-side function to crawl the project directory and collect source code.
 * Excludes heavy/internal directories like node_modules and .next.
 */
export async function getProjectCodebase() {
  const root = process.cwd();
  const files: Record<string, string> = {};
  
  // Directories to completely ignore
  const ignoreDirs = new Set(['node_modules', '.next', '.git', '.idx', 'out', '.agents', '.vscode']);
  // Relevant file extensions for the project
  const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.yaml', '.rules']);

  function walk(dir: string) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(root, fullPath);
      
      // Skip hidden files/dirs starting with dot (except common ones like .env)
      if (item.startsWith('.') && !['.env', '.env.local', '.env.example'].includes(item)) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!ignoreDirs.has(item)) {
          walk(fullPath);
        }
      } else {
        const ext = path.extname(item);
        if (allowedExtensions.has(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            files[relativePath] = content;
          } catch (e) {
            console.error(`Could not read file ${relativePath}:`, e);
          }
        }
      }
    }
  }

  try {
    walk(root);
    return { success: true, files };
  } catch (error: any) {
    console.error("Codebase crawl error:", error);
    return { success: false, error: error.message };
  }
}
