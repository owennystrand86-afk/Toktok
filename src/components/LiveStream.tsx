import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Heart, Gift, MessageSquare, Share2, Shield, CheckCircle, Coins, Monitor, Video as VideoIcon, Radio, Star, Send } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { User, LiveStream as LiveStreamType } from '../types';

interface LiveStreamProps {
  streamId: string;
  onClose: () => void;
}

const GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', price: 1 },
  { id: 'heart', name: 'Heart', icon: '❤️', price: 5 },
  { id: 'coffee', name: 'Coffee', icon: '☕', price: 10 },
  { id: 'pizza', name: 'Pizza', icon: '🍕', price: 20 },
  { id: 'diamond', name: 'Diamond', icon: '💎', price: 100 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', price: 500 },
  { id: 'galaxy', name: 'Galaxy', icon: '🌌', price: 1000, bonus: 0.1 },
];

export const LiveStream: React.FC<LiveStreamProps> = ({ streamId, onClose }) => {
  const [stream, setStream] = useState<LiveStreamType | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<any>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setCurrentUserData(docSnap.data() as User);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser?.uid}`));

    const unsubStream = onSnapshot(doc(db, 'live_streams', streamId), (docSnap) => {
      if (docSnap.exists()) setStream({ id: docSnap.id, ...docSnap.data() } as LiveStreamType);
    }, (err) => handleFirestoreError(err, OperationType.GET, `live_streams/${streamId}`));

    const messagesQuery = query(
      collection(db, `live_streams/${streamId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
    }, (err) => handleFirestoreError(err, OperationType.LIST, `live_streams/${streamId}/messages`));

    return () => {
      unsubUser();
      unsubStream();
      unsubMessages();
      stopStream();
    };
  }, [streamId]);

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const startStream = async () => {
    if (streamRef.current) return; // Already streaming
    setPermissionError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      console.error("Error starting stream:", err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionError("Camera permission denied. Please grant permission in your browser settings and refresh the page.");
      } else {
        setPermissionError("Could not access camera. Please ensure your camera is connected and not in use by another app.");
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setIsScreenSharing(true);
      
      s.getVideoTracks()[0].onended = () => {
        stopStream();
        startStream();
        setIsScreenSharing(false);
      };
    } catch (err) {
      console.error("Error screen sharing:", err);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (stream?.hostId === auth.currentUser?.uid) {
      startStream();
    }
  }, [stream?.hostId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !currentUserData) return;

    try {
      await addDoc(collection(db, `live_streams/${streamId}/messages`), {
        userId: auth.currentUser.uid,
        username: currentUserData.username,
        text: newMessage,
        createdAt: serverTimestamp(),
        type: 'chat'
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `live_streams/${streamId}/messages`);
    }
  };

  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!auth.currentUser || !currentUserData || !stream) return;
    if ((currentUserData.coins || 0) < gift.price) {
      alert("Not enough Cool Coins!");
      return;
    }

    try {
      // Deduct coins from sender
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        coins: increment(-gift.price)
      });

      // Add coins to recipient (host)
      const bonus = (gift as any).bonus || 0;
      const recipientAmount = Math.floor(gift.price * (1 + bonus));
      await updateDoc(doc(db, 'users', stream.hostId), {
        coins: increment(recipientAmount)
      });

      // Add gift message
      await addDoc(collection(db, `live_streams/${streamId}/messages`), {
        userId: auth.currentUser.uid,
        username: currentUserData.username,
        text: `sent a ${gift.name} ${gift.icon}`,
        createdAt: serverTimestamp(),
        type: 'gift',
        giftId: gift.id
      });

      setShowGifts(false);
      
      // Local animation for sender
      if (gift.id === 'galaxy') {
        setActiveGiftAnimation('galaxy');
        setTimeout(() => setActiveGiftAnimation(null), 5000);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'gifting');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 bg-zinc-900">
        <video
          ref={videoRef}
          autoPlay
          muted={stream?.hostId === auth.currentUser?.uid}
          playsInline
          className="w-full h-full object-cover"
        />
        {stream?.hostId !== auth.currentUser?.uid && !videoRef.current?.srcObject && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <Radio size={40} className="text-white" />
            </div>
            <p className="text-zinc-400 font-bold">Waiting for host...</p>
          </div>
        )}

        {permissionError && (
          <div className="absolute inset-0 z-[250] bg-black/90 flex flex-col items-center justify-center p-8 text-center gap-6">
            <div className="p-6 bg-red-500/20 rounded-full">
              <Shield size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold">Camera Access Required</h2>
            <p className="text-zinc-400 text-sm max-w-xs">{permissionError}</p>
            <button 
              onClick={startStream}
              className="bg-red-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
            <button 
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Galaxy Animation Overlay */}
      <AnimatePresence>
        {activeGiftAnimation === 'galaxy' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-[250] pointer-events-none flex items-center justify-center"
          >
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(63,94,251,0.4)_0%,rgba(252,70,107,0.4)_100%)] opacity-50"
              />
              <div className="relative flex flex-col items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-8xl"
                >
                  🌌
                </motion.div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 italic uppercase tracking-tighter">
                  GALAXY GIFT!
                </h2>
                <div className="flex gap-2">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 0, x: 0, opacity: 1 }}
                      animate={{ 
                        y: (Math.random() - 0.5) * 1000, 
                        x: (Math.random() - 0.5) * 1000, 
                        opacity: 0 
                      }}
                      transition={{ duration: 3, delay: Math.random() * 2 }}
                      className="absolute"
                    >
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header UI */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-[210]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-red-500 overflow-hidden bg-zinc-800">
            {stream?.hostPhotoURL ? (
              <img src={stream.hostPhotoURL} alt={stream.hostUsername} className="w-full h-full object-cover" />
            ) : (
              <VideoIcon className="w-full h-full p-2 text-zinc-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">@{stream?.hostUsername}</span>
              <Shield size={12} className="text-blue-400 fill-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-300">
              <span className="flex items-center gap-1">
                <Users size={10} /> {stream?.viewerCount || 0}
              </span>
              <span className="bg-red-500 px-1 rounded font-bold uppercase">Live</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="absolute bottom-20 left-4 right-4 max-h-[40%] overflow-y-auto flex flex-col gap-2 z-[210] mask-gradient-top">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-zinc-400">@{msg.username}:</span>
            <span className={msg.type === 'gift' ? 'text-yellow-400 font-bold italic' : 'text-white'}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-4 bg-gradient-to-t from-black/60 to-transparent z-[210]">
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 bg-zinc-900/60 backdrop-blur-md rounded-full px-4 py-2 border border-zinc-800">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
          />
          <button type="submit" className="text-red-500">
            <Send size={20} />
          </button>
        </form>

        <button 
          onClick={() => setShowGifts(true)}
          className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-lg shadow-yellow-500/20"
        >
          <Gift size={20} />
        </button>

        {stream?.hostId === auth.currentUser?.uid && (
          <button 
            onClick={isScreenSharing ? () => { stopStream(); startStream(); setIsScreenSharing(false); } : startScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-white'}`}
          >
            <Monitor size={20} />
          </button>
        )}

        <button className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white">
          <Share2 size={20} />
        </button>
      </div>

      {/* Gifts Modal */}
      <AnimatePresence>
        {showGifts && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute inset-x-0 bottom-0 bg-zinc-900 rounded-t-3xl p-6 z-[220] border-t border-zinc-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Coins size={20} className="text-yellow-500" />
                <span className="font-bold">{currentUserData?.coins || 0} Cool Coins</span>
              </div>
              <button onClick={() => setShowGifts(false)} className="text-zinc-500">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2">
              {GIFTS.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  className="flex flex-col items-center gap-2 p-3 bg-zinc-800 rounded-2xl hover:bg-zinc-700 transition-all group"
                >
                  <span className="text-3xl group-hover:scale-125 transition-transform">{gift.icon}</span>
                  <span className="text-[10px] font-bold text-zinc-400">{gift.name}</span>
                  <div className="flex items-center gap-1 text-[10px] font-black text-yellow-500">
                    <Coins size={10} />
                    {gift.price}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
