import React from 'react';
import { createPortal } from 'react-dom';
import { X, HeartPulse, ExternalLink, Info } from 'lucide-react';

const OrganDonorModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
              <HeartPulse size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Organ Donation Information</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Learn about saving lives</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex gap-3 text-sm border border-blue-100 dark:border-blue-800">
            <Info className="shrink-0 w-5 h-5" />
            <p>
              <strong>Notice:</strong> LifeOS does not officially register you as an organ donor. To become a legally recognized organ donor, you must register through your government's official health department or motor vehicle registry.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Why Register?</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
              A single organ donor can save up to 8 lives and improve the lives of up to 75 people through tissue donation. Anyone can register to be an organ donor regardless of age or medical history.
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-sm space-y-2">
              <li>Organs that can be donated include the heart, kidneys, pancreas, lungs, liver, and intestines.</li>
              <li>Tissue that can be donated includes eyes, skin, bone, and heart valves.</li>
              <li>Your medical care will not be affected by your donor status.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">How to Register (US)</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              If you live in the United States, you can officially register as an organ donor online or at your local DMV.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Close
          </button>
          <a href="https://www.organdonor.gov/sign-up" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm flex items-center gap-2">
            Register Officially <ExternalLink size={18} />
          </a>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default OrganDonorModal;
