import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Comment, Video, User } from '../types';
import { X, Send, User as UserIcon, MessageCircle, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommentsProps {
  video: Video;
  onClose: () => void;
}

export default function Comments({ video, onClose }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as User);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser.uid}`);
        }
      }
    };
    fetchUserData();
  }, []);

  const isSuspended = () => {
    if (!userData?.isSuspendedUntil) return false;
    const suspensionDate = userData.isSuspendedUntil.toDate ? userData.isSuspendedUntil.toDate() : new Date(userData.isSuspendedUntil);
    return suspensionDate > new Date();
  };

  useEffect(() => {
    if (video.id.startsWith('initial_')) {
      setLoading(false);
      return;
    }
    const commentsCol = collection(db, `videos/${video.id}/comments`);
    const q = query(commentsCol, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `videos/${video.id}/comments`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [video.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser || video.id.startsWith('initial_') || isSuspended()) return;

    const commentData = {
      videoId: video.id,
      userId: auth.currentUser.uid,
      username: auth.currentUser.displayName || 'Anonymous',
      userPhotoURL: auth.currentUser.photoURL || '',
      text: newComment.trim(),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, `videos/${video.id}/comments`), commentData);
      await updateDoc(doc(db, 'videos', video.id), {
        commentsCount: increment(1)
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `videos/${video.id}/comments`);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute bottom-0 left-0 right-0 h-[70%] bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="w-8" />
        <h3 className="text-white font-semibold">{video.commentsCount} comments</h3>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {video.id.startsWith('initial_') && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center px-4">
            <Lock size={48} className="mb-2 opacity-20" />
            <p>Comments are disabled for this demo video. Log in as admin to seed real videos!</p>
          </div>
        )}
        {!video.id.startsWith('initial_') && comments.map(comment => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
              {comment.userPhotoURL ? (
                <img src={comment.userPhotoURL} alt={comment.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="text-zinc-500 p-1" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-zinc-400 text-xs font-bold mb-1">{comment.username}</p>
              <p className="text-white text-sm">{comment.text}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <MessageCircle size={48} className="mb-2 opacity-20" />
            <p>No comments yet. Be the first!</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
        <div className="flex-1 bg-zinc-800 rounded-full px-4 py-2 flex items-center">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              video.id.startsWith('initial_') 
                ? "Comments disabled" 
                : isSuspended() 
                  ? "You are suspended" 
                  : "Add comment..."
            }
            className="bg-transparent border-none outline-none text-white text-sm w-full"
            disabled={!auth.currentUser || video.id.startsWith('initial_') || isSuspended()}
          />
        </div>
        <button
          type="submit"
          disabled={!newComment.trim() || !auth.currentUser || video.id.startsWith('initial_') || isSuspended()}
          className="text-red-500 disabled:text-zinc-600 transition-colors"
        >
          <Send size={24} />
        </button>
      </form>
      {!auth.currentUser && !video.id.startsWith('initial_') && (
        <div className="bg-red-500/10 p-2 text-center">
          <p className="text-red-500 text-xs">Please sign in to comment</p>
        </div>
      )}
      {auth.currentUser && isSuspended() && (
        <div className="bg-red-500/10 p-2 text-center flex items-center justify-center gap-2">
          <AlertTriangle size={12} className="text-red-500" />
          <p className="text-red-500 text-xs">Your account is suspended</p>
        </div>
      )}
    </motion.div>
  );
}
