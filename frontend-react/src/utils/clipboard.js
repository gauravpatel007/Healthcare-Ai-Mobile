export const copyToClipboard = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for non-secure contexts (like HTTP)
        let textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('Copy command was unsuccessful');
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            throw err;
        } finally {
            document.body.removeChild(textArea);
        }
        return Promise.resolve();
    }
};
