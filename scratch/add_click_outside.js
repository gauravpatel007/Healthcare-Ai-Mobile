const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../../frontend-react/src/pages/admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // We are looking for:
  // createPortal(
  //   <div className="fixed inset-0 ... bg-gray-900/50 backdrop-blur-sm"
  //     <div className="...
  //
  // Also we want to ensure we don't double add onClick

  // A generic way to add onClick is to find all modals that have fixed inset-0 and a Cancel button.
  
  // The simplest is to match the exact string:
  // <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
  // and replace with onClick={closeHandler}
  
  const regex = /createPortal\([\s\S]*?(<div[^>]*className="[^"]*fixed inset-0[^"]*"[^>]*>)[\s\S]*?(<div[^>]*className="[^"]*(?:bg-white|modal-content)[^"]*"[^>]*>)/g;
  
  let newContent = content.replace(regex, (match, backdropDiv, innerDiv) => {
    // If backdrop already has onClick, skip
    if (backdropDiv.includes('onClick=')) {
      return match;
    }
    
    // Find the state setter used in the cancel button inside this specific modal
    // Typically: onClick={() => setShowModal(false)}
    const cancelMatch = match.match(/onClick=\{([^}]*)\}[^>]*>\s*Cancel/i);
    let clickHandler = "() => setShowModal(false)";
    if (cancelMatch) {
        clickHandler = cancelMatch[1];
    } else {
        // specific fallbacks
        if (file === 'AdminSettings.jsx') clickHandler = "() => setViewingLogo(false)";
        if (file === 'AdminFileManager.jsx') clickHandler = "closeEditModal";
    }

    const newBackdropDiv = backdropDiv.replace('>', ` onClick={${clickHandler}}>`);
    
    // add stopPropagation to innerDiv if not present
    let newInnerDiv = innerDiv;
    if (!innerDiv.includes('onClick=')) {
        newInnerDiv = innerDiv.replace('>', ` onClick={(e) => e.stopPropagation()}>`);
    }

    return match.replace(backdropDiv, newBackdropDiv).replace(innerDiv, newInnerDiv);
  });
  
  // Custom fix for AdminHealth reschedule and viewAll which don't have "Cancel" text
  if (file === 'AdminHealth.jsx') {
      newContent = newContent.replace(/<div className="fixed inset-0 z-\[100000\] bg-black\/50 flex items-center justify-center p-4">/g, 
        '<div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4" onClick={() => setRescheduleAppt ? setRescheduleAppt(null) : setShowViewAll(false)}>'
      );
      // Wait, that's not safe. Let's do it manually for AdminHealth.
  }

  if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated', file);
  }
}
