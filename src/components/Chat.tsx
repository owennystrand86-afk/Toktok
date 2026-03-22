import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, limit } from 'firebase/firestore';
import { Message, User } from '../types';
import { Send, ArrowLeft, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  otherUserId: string;
  onBack: () => void;
}

export const Chat: React.FC<ChatProps> = ({ otherUserId, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOtherUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', otherUserId));
      if (userDoc.exists()) {
        setOtherUser(userDoc.data() as User);
      }
    };
    fetchOtherUser();
  }, [otherUserId]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(msg => 
          (msg.senderId === auth.currentUser?.uid && msg.receiverId === otherUserId) ||
          (msg.senderId === otherUserId && msg.receiverId === auth.currentUser?.uid)
        );
      setMessages(msgs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

    return () => unsubscribe();
  }, [otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: auth.currentUser.uid,
        receiverId: otherUserId,
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
        participants: [auth.currentUser.uid, otherUserId]
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'messages');
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <button onClick={onBack} className="mr-4 p-1 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
            {otherUser?.photoURL ? (
              <img src={otherUser.photoURL} alt={otherUser.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                {otherUser?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">{otherUser?.username}</span>
              {otherUser?.isAdmin && <Shield size={14} className="text-emerald-400 fill-emerald-400/20" />}
              {otherUser?.isVerified && <Shield size={14} className="text-blue-400 fill-blue-400/20" />}
            </div>
            <span className="text-xs text-zinc-500">Active now</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-zinc-800 text-zinc-100 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 bg-zinc-800 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-emerald-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};
