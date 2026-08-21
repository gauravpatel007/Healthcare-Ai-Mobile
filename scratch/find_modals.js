const fs = require('fs');
const path = require('path');

const adminDir = path.join('g:', 'Languages', 'Projects', 'Healthcare AI', 'R1', 'frontend-react', 'src', 'pages', 'admin');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    if (!content.includes('fixed inset-0') && !content.includes('modal-overlay')) {
        return;
    }
    
    // Check if createPortal is already imported
    if (!content.includes('createPortal')) {
        // Add import { createPortal } from 'react-dom'; after the first import
        content = content.replace(/import React(.*?)\n/, "import React$1\nimport { createPortal } from 'react-dom';\n");
    }

    // A robust regex to find conditional modals like `{showAddModal && (` 
    // where the inner content starts with `<div className="...fixed inset-0...`
    // This is hard to do with pure regex because of matching brackets.
    // However, we can use a simpler approach since we know the structure.
    
    // Actually, it's safer to just let the LLM do it manually using multi_replace_file_content 
    // if I can't trust the script. But wait, I'm writing this script.
    
    // Let's replace the outer {showXYZ && ( <div className="fixed inset-0 ...> ... </div> )}
    // Let's find all occurrences of 'fixed inset-0' and 'modal-overlay'
    // Since I can't easily parse AST in a plain script, I will just output the files that need manual fixing.
}

console.log("Reading admin files...");
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.jsx'));
for (const f of files) {
    const fullPath = path.join(adminDir, f);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('fixed inset-0') || content.includes('modal-overlay')) {
        console.log(f);
    }
}
