
/**
 * UI Audit Script
 * Scans src/ directory for common UI anti-patterns.
 * Usage: node scripts/ui-audit.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..'); // Adjust to project root

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'scripts'];
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

let fileCount = 0;
let issues = {
    inlineStyles: [],
    hardcodedPadding: [],
    rawButtons: [],
    hardcodedColors: []
};

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(ROOT_DIR, filePath);

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // 1. Inline Styles (Risk of inconsistency)
        if (line.includes('style={{') && !line.includes('width') && !line.includes('height')) {
            issues.inlineStyles.push(`${relativePath}:${lineNum} - Avoid inline style={{...}} for non-dynamic values.`);
        }

        // 2. Hardcoded Padding (Inconsistent spacing)
        if (line.match(/className=".*p-\[\d+px\].*"/)) {
            issues.hardcodedPadding.push(`${relativePath}:${lineNum} - Arbitrary padding value (e.g. p-[123px]).`);
        }

        // 3. Raw Buttons (Should use UI <Button>)
        if (line.includes('<button') && line.includes('className') && !relativePath.includes('ui/Primitives') && !relativePath.includes('ui/Tokens')) {
            if (!line.includes('material-symbols-outlined') && !line.includes('sr-only')) {
                issues.rawButtons.push(`${relativePath}:${lineNum} - Raw <button> detected. Consider using <Button> component for consistency.`);
            }
        }

        // 4. Hardcoded Hex Colors (Should use Tailwind classes)
        const hexMatch = line.match(/#[0-9A-Fa-f]{6}/);
        if (hexMatch && !relativePath.includes('tailwind.config') && !relativePath.includes('index.html')) {
             issues.hardcodedColors.push(`${relativePath}:${lineNum} - Hardcoded HEX color ${hexMatch[0]}. Use Tailwind colors (e.g. bg-blue-500).`);
        }
    });
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (IGNORE_DIRS.includes(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (SCAN_EXTENSIONS.includes(path.extname(fullPath))) {
            scanFile(fullPath);
            fileCount++;
        }
    }
}

console.log('🔍 Starting UI Consistency Audit...');
try {
    walkDir(ROOT_DIR);
} catch(e) {
    console.error("Error scanning files. Ensure you are in the project root.", e);
}

console.log(`\nChecked ${fileCount} files.\n`);

console.log('--- 🎨 Hardcoded Hex Colors (Use Tokens/Tailwind) ---');
if (issues.hardcodedColors.length) issues.hardcodedColors.forEach(i => console.log(i));
else console.log('✅ Clean.');

console.log('\n--- 📏 Arbitrary Spacing (Use standard classes) ---');
if (issues.hardcodedPadding.length) issues.hardcodedPadding.forEach(i => console.log(i));
else console.log('✅ Clean.');

console.log('\n--- 🔘 Raw Buttons (Consider <Button> component) ---');
issues.rawButtons.slice(0, 10).forEach(i => console.log(i));
if (issues.rawButtons.length > 10) console.log(`... and ${issues.rawButtons.length - 10} more.`);
if (issues.rawButtons.length === 0) console.log('✅ Clean.');

console.log('\n--- ⚠️ Inline Styles (Avoid if possible) ---');
issues.inlineStyles.forEach(i => console.log(i));
if (issues.inlineStyles.length === 0) console.log('✅ Clean.');

console.log('\n✨ Audit Complete.');
