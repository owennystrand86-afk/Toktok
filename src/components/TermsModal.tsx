import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface TermsModalProps {
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onAccept }) => {
  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-red-500/20 p-4 rounded-full">
            <ShieldCheck size={48} className="text-red-500" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-6">Terms of Service & Rules</h2>
        
        <div className="space-y-6 text-zinc-300 text-sm leading-relaxed mb-8">
          <section>
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              1. Community Guidelines
            </h3>
            <p>
              By using TokTok, you agree to be respectful to all users. We have zero tolerance for hate speech, 
              harassment, or explicit content.
            </p>
          </section>
          
          <section>
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              2. Content Ownership
            </h3>
            <p>
              You retain ownership of the content you post, but you grant us a license to display it on the platform.
            </p>
          </section>
          
          <section>
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              3. Account Safety
            </h3>
            <p>
              You are responsible for maintaining the security of your account. Do not share your login credentials.
            </p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              4. Moderation
            </h3>
            <p>
              Administrators have the right to warn, suspend, or ban users who violate these rules. 
              Decisions made by moderators are final.
            </p>
          </section>
        </div>
        
        <button
          onClick={onAccept}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-500/20"
        >
          I Agree to the Terms & Rules
        </button>
        
        <p className="text-center text-zinc-500 text-xs mt-4">
          By clicking "I Agree", you confirm that you have read and understood our rules.
        </p>
      </motion.div>
    </div>
  );
};
