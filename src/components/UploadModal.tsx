import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Link as LinkIcon, Loader2, Camera } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { User } from '../types';
import { VideoRecorder } from './VideoRecorder';
import { useXP } from '../hooks/useXP';

interface UploadModalProps {
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose }) => {
  const { addXP } = useXP();
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setCurrentUserData(docSnap.data() as User);
        }
      });
    }
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (currentUserData?.isSuspendedUntil) {
        const suspensionDate = currentUserData.isSuspendedUntil.toDate ? currentUserData.isSuspendedUntil.toDate() : new Date(currentUserData.isSuspendedUntil);
        if (suspensionDate > new Date()) {
          setError(`Your account is suspended until ${suspensionDate.toLocaleString()}. You cannot upload videos at this time.`);
          return;
        }
      }

      if ((!videoUrl && !selectedBlob) || !description) {
        setError("Please fill in all fields");
        return;
      }

      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      let finalVideoUrl = videoUrl;

      // If we have a blob (from recording or file select), upload it to Firebase Storage
      if (selectedBlob) {
        const fileExtension = selectedBlob.type.split('/')[1]?.split(';')[0] || 'mp4';
        const fileName = `videos/${auth.currentUser.uid}/${Date.now()}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        
        console.log("Uploading blob to Firebase Storage:", fileName);
        
        const uploadTask = uploadBytesResumable(storageRef, selectedBlob);
        
        finalVideoUrl = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              console.log('Upload is ' + progress + '% done');
            }, 
            (error) => {
              console.error("Upload task error:", error);
              reject(error);
            }, 
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
        
        console.log("Upload successful, download URL:", finalVideoUrl);
      }

      await addDoc(collection(db, 'videos'), {
        creatorId: auth.currentUser.uid,
        creatorUsername: currentUserData?.username || auth.currentUser.displayName || 'user',
        creatorPhotoURL: auth.currentUser.photoURL || '',
        videoUrl: finalVideoUrl,
        description,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: serverTimestamp(),
        isVerifiedCreator: currentUserData?.isVerified || false,
        isAdminCreator: currentUserData?.isAdmin || false
      });

      // Reward XP for uploading
      addXP(100);

      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      handleFirestoreError(err, OperationType.WRITE, 'videos');
      setError("Failed to upload video. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    console.log("Recording complete, blob size:", blob.size);
    if (blob.size === 0) {
      setError("Recording failed: No data captured. Please try again.");
      setShowRecorder(false);
      return;
    }
    // Increased limit to 50MB for Storage
    if (blob.size > 50 * 1024 * 1024) {
      setError("Recording is too large (>50MB). Try a shorter recording.");
      setShowRecorder(false);
      return;
    }
    
    setSelectedBlob(blob);
    const previewUrl = URL.createObjectURL(blob);
    setVideoUrl(previewUrl);
    setShowRecorder(false);
  };

  return (
    <>
      <AnimatePresence>
        {showRecorder && (
          <VideoRecorder 
            onComplete={handleRecordingComplete} 
            onCancel={() => setShowRecorder(false)} 
          />
        )}
      </AnimatePresence>

      <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden"
        >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Upload Video</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setShowRecorder(true)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <div className="p-3 bg-red-500/10 rounded-full group-hover:bg-red-500/20 transition-colors relative">
                <Camera size={24} className="text-red-500" />
                <div className="absolute -top-1 -right-1 bg-red-500 text-[8px] text-white px-1 rounded-full font-bold">HQ</div>
              </div>
              <span className="text-sm font-medium">Record</span>
            </button>
            <label className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer">
              <input 
                type="file" 
                accept="video/*,image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 50 * 1024 * 1024) {
                      setError("File is too large. Maximum size is 50MB.");
                      return;
                    }
                    setSelectedBlob(file);
                    const previewUrl = URL.createObjectURL(file);
                    setVideoUrl(previewUrl);
                  }
                }}
              />
              <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                <Upload size={24} className="text-blue-500" />
              </div>
              <span className="text-sm font-medium">Upload</span>
            </label>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">Or use a link</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <LinkIcon size={16} />
              Video URL
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              required
            />
            {videoUrl && (videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')) && (
              <p className="text-[10px] text-green-500 font-medium">
                ✓ Video selected successfully
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your video #trending #toktok"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-500/20 overflow-hidden relative"
          >
            {isUploading && (
              <motion.div 
                className="absolute inset-0 bg-red-600/50 origin-left z-0"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: uploadProgress / 100 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
              />
            )}
            <div className="relative z-10 flex items-center gap-2">
              {isUploading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{uploadProgress < 100 ? `Uploading ${Math.round(uploadProgress)}%...` : 'Finalizing...'}</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span>Post Video</span>
                </>
              )}
            </div>
          </button>
        </form>
      </motion.div>
      </div>
    </>
  );
};
