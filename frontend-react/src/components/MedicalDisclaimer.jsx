import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

const MedicalDisclaimer = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenDisclaimer = localStorage.getItem('hasSeenMedicalDisclaimer');
    if (!hasSeenDisclaimer) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('hasSeenMedicalDisclaimer', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 relative animate-in fade-in zoom-in duration-300">
      <div className="flex gap-3">
        <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Medical Disclaimer</h4>
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed pr-6">
            The AI features in this platform are for informational purposes only and do not constitute professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns. In an emergency, dial 108 or use the SOS feature immediately.
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors p-1"
        aria-label="Dismiss disclaimer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default MedicalDisclaimer;
