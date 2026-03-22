import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signInWithGoogle, db, handleFirestoreError, OperationType } from './firebase';
import VideoFeed from './components/VideoFeed';
import Profile from './components/Profile';
import Comments from './components/Comments';
import { TermsModal } from './components/TermsModal';
import { UploadModal } from './components/UploadModal';
import { useAuth } from './hooks/useAuth';
import { useSound, soundManager } from './utils';
import { Home, Search, Plus, MessageSquare, User as UserIcon, LogIn, LogOut, Loader2, Ban, Coins, X, Send, Video as VideoIcon, Radio, Users, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { doc, getDoc, updateDoc, increment, serverTimestamp, collection, query, where, onSnapshot, addDoc, orderBy, limit } from 'firebase/firestore';
import { Video, LiveStream as LiveStreamType, PlatformSettings } from './types';

import { LiveStream } from './components/LiveStream';
import { Chat } from './components/Chat';
import { AdminPanel } from './components/AdminPanel';


export default function App() {
  const { user, userData, loading: authLoading, isAdmin } = useAuth();
  const { play } = useSound();
  
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'inbox' | 'profile' | 'live'>('home');
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [selectedVideoComments, setSelectedVideoComments] = useState<Video | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showDailyClaim, setShowDailyClaim] = useState(false);
  const [activeLiveStreamId, setActiveLiveStreamId] = useState<string | null>(null);
  const [liveStreams, setLiveStreams] = useState<LiveStreamType[]>([]);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    maintenanceMode: false,
    maintenanceMessage: 'The platform is currently under maintenance. Please check back later.',
    globalSoundEnabled: true,
    registrationEnabled: true
  });

  useEffect(() => {
    const settingsRef = doc(db, 'platform_settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as PlatformSettings;
        setPlatformSettings(data);
        // Apply global sound setting
        soundManager.setEnabled(data.globalSoundEnabled);
      }
    }, (error) => {
      console.error("Platform settings listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'platform_settings/global');
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  useEffect(() => {
    if (userData) {
      const lastClaim = userData.lastDailyClaim?.toDate ? userData.lastDailyClaim.toDate() : (userData.lastDailyClaim ? new Date(userData.lastDailyClaim) : null);
      const now = new Date();
      if (!lastClaim || (now.getTime() - lastClaim.getTime() > 24 * 60 * 60 * 1000)) {
        setShowDailyClaim(true);
      }
    }
  }, [userData]);

  useEffect(() => {
    const liveQuery = query(collection(db, 'live_streams'), where('status', '==', 'live'), limit(20));
    const unsubscribe = onSnapshot(liveQuery, (snapshot) => {
      setLiveStreams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LiveStreamType));
    }, (error) => {
      console.error("Live streams listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'live_streams');
    });
    return () => unsubscribe();
  }, []);

  const handleGoLive = async () => {
    if (!user || !userData) return;
    if (!userData.canGoLive && (userData.followersCount || 0) < 1000) {
      alert("You need 1,000 followers to go live!");
      return;
    }

    try {
      const liveRef = await addDoc(collection(db, 'live_streams'), {
        hostId: user.uid,
        hostUsername: userData.username,
        hostPhotoURL: user.photoURL || '',
        status: 'live',
        viewerCount: 0,
        createdAt: serverTimestamp(),
        title: `${userData.username}'s Live Stream`
      });
      setActiveLiveStreamId(liveRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'live_streams');
    }
  };

  const handleJoinLive = (streamId: string) => {
    setActiveLiveStreamId(streamId);
  };

  const handleOpenChat = (userId: string) => {
    setActiveChatUserId(userId);
    setActiveTab('inbox');
  };

  const handleClaimDaily = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        coins: increment(100),
        lastDailyClaim: serverTimestamp()
      });
      setShowDailyClaim(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAcceptTerms = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hasAcceptedTerms: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (platformSettings.maintenanceMode && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8 text-center">
        <div className="bg-blue-500/20 p-6 rounded-full mb-6">
          <Shield size={64} className="text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-zinc-400 mb-8 max-w-xs">
          {platformSettings.maintenanceMessage}
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={handleSignIn}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Admin Login
          </button>
          {user && (
            <button 
              onClick={() => auth.signOut()}
              className="text-zinc-500 hover:text-white transition-colors text-sm"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  if (userData?.isBanned) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8 text-center">
        <div className="bg-red-500/20 p-6 rounded-full mb-6">
          <Ban size={64} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-red-500">Account Banned</h1>
        <p className="text-zinc-400 mb-8 max-w-xs">
          Your account has been permanently banned for violating our community guidelines and terms of service.
        </p>
        <button 
          onClick={() => auth.signOut()}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  const handleProfileClick = (uid: string) => {
    setSelectedProfileUid(uid);
    setShowProfile(true);
  };

  const handleVideoClick = (video: Video) => {
    setShowProfile(false);
    setSelectedProfileUid(null);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden max-w-md mx-auto relative border-x border-zinc-800 shadow-2xl">
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'home' && (
          <VideoFeed 
            onProfileClick={handleProfileClick} 
            onCommentClick={(video) => setSelectedVideoComments(video)} 
          />
        )}

        {activeTab === 'inbox' && user && (
          <div className="h-full bg-zinc-950 flex flex-col">
            {activeChatUserId ? (
              <Chat otherUserId={activeChatUserId} onBack={() => setActiveChatUserId(null)} />
            ) : (
              <>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Inbox</h2>
                  <MessageSquare size={24} className="text-zinc-500" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <div className="p-6 bg-zinc-900 rounded-full">
                    <MessageSquare size={48} className="text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-bold">No messages yet</h3>
                  <p className="text-zinc-500 text-sm">Messages will appear here when you follow someone back and start a conversation.</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="h-full bg-zinc-950 flex flex-col">
            {activeLiveStreamId ? (
              <LiveStream streamId={activeLiveStreamId} onEnd={() => setActiveLiveStreamId(null)} />
            ) : (
              <>
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Live Streams</h2>
                  {(userData?.canGoLive || (userData?.followersCount || 0) >= 1000) && (
                    <button 
                      onClick={handleGoLive}
                      className="bg-red-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-red-600 transition-all flex items-center gap-1"
                    >
                      <Radio size={14} />
                      Go Live
                    </button>
                  )}
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto">
                  {liveStreams.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {liveStreams.map(stream => (
                        <motion.div
                          whileTap={{ scale: 0.98 }}
                          key={stream.id}
                          onClick={() => handleJoinLive(stream.id)}
                          className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer bg-zinc-900"
                        >
                          <img src={stream.hostPhotoURL} alt={stream.hostUsername} className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                          <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                            Live
                          </div>
                          <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Users size={10} />
                            {stream.viewerCount || 0}
                          </div>
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-white font-bold text-xs truncate">{stream.title}</p>
                            <p className="text-white/60 text-[10px]">@{stream.hostUsername}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                      <div className="p-6 bg-zinc-900 rounded-full">
                        <VideoIcon size={48} className="text-zinc-600" />
                      </div>
                      <h3 className="text-lg font-bold">No one is live</h3>
                      <p className="text-zinc-500 text-sm">Check back later to watch your favorite creators live!</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'profile' && user && (
          <Profile 
            uid={user.uid} 
            onBack={() => setActiveTab('home')} 
            onVideoClick={handleVideoClick}
            onOpenChat={handleOpenChat}
            onOpenAdminPanel={() => setShowAdminPanel(true)}
          />
        )}

        {/* Profile Overlay */}
        <AnimatePresence>
          {showProfile && selectedProfileUid && (
            <Profile 
              uid={selectedProfileUid} 
              onBack={() => setShowProfile(false)} 
              onVideoClick={handleVideoClick}
              onOpenChat={handleOpenChat}
              onOpenAdminPanel={() => setShowAdminPanel(true)}
            />
          )}
        </AnimatePresence>

        {/* Comments Overlay */}
        <AnimatePresence>
          {selectedVideoComments && (
            <Comments 
              video={selectedVideoComments} 
              onClose={() => setSelectedVideoComments(null)} 
            />
          )}
        </AnimatePresence>

        {/* Terms of Service Overlay */}
        <AnimatePresence>
          {user && userData && !userData.hasAcceptedTerms && (
            <TermsModal onAccept={handleAcceptTerms} />
          )}
        </AnimatePresence>

        {/* Upload Overlay */}
        <AnimatePresence>
          {showUpload && (
            <UploadModal onClose={() => setShowUpload(false)} />
          )}
        </AnimatePresence>

        {/* Daily Claim Modal */}
        <AnimatePresence>
          {showDailyClaim && user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 z-[150] flex items-center justify-center p-6 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-xs text-center flex flex-col items-center gap-6 shadow-2xl"
              >
                <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center relative">
                  <Coins size={48} className="text-yellow-500 animate-bounce" />
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-full">
                    +100
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black mb-2">Daily Reward!</h2>
                  <p className="text-zinc-400 text-sm">You earned 100 Cool Coins today. Come back tomorrow for more!</p>
                </div>
                <button
                  onClick={handleClaimDaily}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-yellow-500/20"
                >
                  Claim Now
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin Panel */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}
      </AnimatePresence>

      {/* Auth Overlay (if not logged in and trying to access profile) */}
        <AnimatePresence>
          {(activeTab === 'profile' || activeTab === 'inbox') && !user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-8 text-center"
            >
              <UserIcon size={64} className="mb-6 text-zinc-600" />
              <h2 className="text-2xl font-bold mb-2">Log in to TokTok</h2>
              <p className="text-zinc-400 mb-8">Manage your profile, see notifications, comment on videos, and more.</p>
              
              {authError && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {authError}
                </div>
              )}

              <button
                onClick={handleSignIn}
                className="bg-red-500 text-white font-bold py-3 px-8 rounded-md flex items-center gap-2 hover:bg-red-600 transition-colors w-full justify-center"
              >
                <LogIn size={20} />
                Continue with Google
              </button>
              <button 
                onClick={() => setActiveTab('home')}
                className="mt-4 text-zinc-500 hover:text-white transition-colors"
              >
                Maybe later
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="h-16 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-40">
        <button 
          onClick={() => { setActiveTab('home'); setShowProfile(false); soundManager.play('click'); }}
          className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'home' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Home size={24} fill={activeTab === 'home' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => { setActiveTab('live'); soundManager.play('click'); }}
          className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'live' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Radio size={24} className={activeTab === 'live' ? 'text-red-500' : ''} />
          <span className="text-[10px] font-bold">Live</span>
        </button>
        <button 
          onClick={() => {
            if (user) {
              setShowUpload(true);
              soundManager.play('click');
            } else {
              handleSignIn();
            }
          }}
          className="flex items-center justify-center transition-transform active:scale-90"
        >
          <div className="relative w-12 h-8">
            <div className="absolute inset-0 bg-cyan-400 rounded-lg translate-x-[-2px]" />
            <div className="absolute inset-0 bg-red-500 rounded-lg translate-x-[2px]" />
            <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center text-black">
              <Plus size={20} strokeWidth={3} />
            </div>
          </div>
        </button>
        <button 
          onClick={() => { setActiveTab('inbox'); soundManager.play('click'); }}
          className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'inbox' ? 'text-white' : 'text-zinc-500'}`}
        >
          <MessageSquare size={24} fill={activeTab === 'inbox' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">Inbox</span>
        </button>
        <button 
          onClick={() => {
            soundManager.play('click');
            if (user) {
              handleProfileClick(user.uid);
              setActiveTab('profile');
            } else {
              setActiveTab('profile');
            }
          }}
          className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'profile' ? 'text-white' : 'text-zinc-500'}`}
        >
          <UserIcon size={24} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </nav>

      {/* User Status Bar (Top) */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-30 pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <button className="text-white/60 font-bold text-lg hover:text-white transition-colors">Following</button>
          <button className="text-white font-bold text-lg border-b-2 border-white pb-1">For You</button>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {user && isAdmin && (
            <button 
              onClick={() => { setShowAdminPanel(true); play('click'); }}
              className="bg-blue-500/20 backdrop-blur-md p-2 rounded-full border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all"
              title="Admin Panel"
            >
              <Shield size={18} />
            </button>
          )}
          {user && userData && (
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Coins size={14} className="text-yellow-500" />
              <span className="text-xs font-bold text-yellow-500">{userData.coins || 0}</span>
            </div>
          )}
          {user ? (
            <button 
              onClick={() => { auth.signOut(); soundManager.play('click'); }} 
              className="text-white/60 hover:text-white transition-colors p-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSignIn} 
              className="text-white/60 hover:text-white transition-colors p-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
            >
              <LogIn size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
