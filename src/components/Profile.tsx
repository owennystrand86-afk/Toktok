import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, deleteDoc, getDocs, writeBatch, increment, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, reportContent } from '../firebase';
import { User, Video } from '../types';
import { 
  ArrowLeft, 
  Grid, 
  Heart,
  Lock, 
  User as UserIcon, 
  Loader2, 
  Shield, 
  Ban, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Video as VideoIcon,
  ExternalLink,
  Instagram,
  Twitter,
  Youtube,
  Globe,
  Flag,
  Camera,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileProps {
  uid: string;
  onBack: () => void;
  onVideoClick: (video: Video) => void;
  onOpenChat?: (userId: string) => void;
  onOpenAdminPanel?: () => void;
}

export default function Profile({ uid, onBack, onVideoClick, onOpenChat, onOpenAdminPanel }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'liked'>('videos');
  const isAdmin = auth.currentUser?.email === 'owennystrand86@gmail.com';
  const isOwnProfile = auth.currentUser?.uid === uid;
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: '',
    bio: '',
    externalLinks: {
      tiktok: '',
      instagram: '',
      youtube: '',
      twitter: '',
      website: ''
    }
  });

  useEffect(() => {
    if (user && isOwnProfile) {
      setEditData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        externalLinks: {
          tiktok: user.externalLinks?.tiktok || '',
          instagram: user.externalLinks?.instagram || '',
          youtube: user.externalLinks?.youtube || '',
          twitter: user.externalLinks?.twitter || '',
          website: user.externalLinks?.website || ''
        }
      });
    }
  }, [user, isOwnProfile]);

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: editData.displayName,
        bio: editData.bio,
        externalLinks: editData.externalLinks
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleReportUser = async () => {
    if (!user || !currentUserData) return;
    const reason = prompt("Why are you reporting this user?");
    if (!reason) return;
    
    try {
      await reportContent(
        currentUserData.uid,
        currentUserData.username,
        user.uid,
        'user',
        reason
      );
      alert("Report submitted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    }
  };
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutualFollow, setIsMutualFollow] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setCurrentUserData(docSnap.data() as User);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !uid) return;
    
    // Check if current user is following this profile
    const followRef = doc(db, `users/${uid}/followers`, auth.currentUser.uid);
    const unsubscribe = onSnapshot(followRef, (docSnap) => {
      setIsFollowing(docSnap.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/followers/${auth.currentUser?.uid}`));

    // Check for mutual follow (if this profile follows current user)
    const mutualFollowRef = doc(db, `users/${auth.currentUser.uid}/followers`, uid);
    const unsubscribeMutual = onSnapshot(mutualFollowRef, (docSnap) => {
      setIsMutualFollow(docSnap.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}/followers/${uid}`));

    return () => {
      unsubscribe();
      unsubscribeMutual();
    };
  }, [uid]);

  const handleFollow = async () => {
    if (!auth.currentUser || !uid || isOwnProfile) return;
    
    try {
      const followerRef = doc(db, `users/${uid}/followers`, auth.currentUser.uid);
      const followingRef = doc(db, `users/${auth.currentUser.uid}/following`, uid);
      const targetUserRef = doc(db, 'users', uid);
      const currentUserRef = doc(db, 'users', auth.currentUser.uid);

      if (isFollowing) {
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
      } else {
        await setDoc(followerRef, { createdAt: new Date().toISOString() });
        await setDoc(followingRef, { createdAt: new Date().toISOString() });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/followers`);
    }
  };

  useEffect(() => {
    const videosCol = collection(db, 'videos');
    const q = query(videosCol, where('creatorId', '==', uid), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      setVideos(videoList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  useEffect(() => {
    const userRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUser(doc.data() as User);
      } else {
        // Fallback
        setUser({
          uid,
          displayName: 'Unknown User',
          photoURL: `https://picsum.photos/seed/${uid}/200/200`,
          username: 'unknown',
          bio: 'This user profile could not be found.',
          createdAt: new Date().toISOString(),
          followersCount: 0,
          followingCount: 0,
          coins: 0
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleAdminCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode.toLowerCase() === 'beta') {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, { isAdmin: true });
          alert("Admin access granted!");
          setShowAdminCode(false);
          setAdminCode('');
        } catch (error) {
          console.error("Error granting admin access:", error);
          alert("Failed to grant admin access. You might not have permission to update your profile.");
        }
      }
    } else {
      alert("Incorrect code.");
    }
  };

  const handleAdminAction = async (action: 'ban' | 'warn' | 'suspend' | 'verify' | 'live' | 'admin' | 'coins') => {
    if (!auth.currentUser || !user) return;
    
    // Check if current user is admin (using the email check for now or the isAdmin flag)
    const isCurrentAdmin = auth.currentUser.email === 'owennystrand86@gmail.com' || (await getDoc(doc(db, 'users', auth.currentUser.uid))).data()?.isAdmin;
    if (!isCurrentAdmin) return;

    const userRef = doc(db, 'users', uid);
    try {
      switch (action) {
        case 'ban':
          await updateDoc(userRef, { isBanned: !user.isBanned });
          break;
        case 'warn':
          await updateDoc(userRef, { warnings: (user.warnings || 0) + 1 });
          break;
        case 'suspend':
          const suspendUntil = new Date();
          suspendUntil.setDate(suspendUntil.getDate() + 7); // 7 days suspension
          await updateDoc(userRef, { isSuspendedUntil: suspendUntil.toISOString() });
          break;
        case 'verify':
          await updateDoc(userRef, { isVerified: !user.isVerified });
          // Also update all their videos to show verified status
          const videosCol = collection(db, 'videos');
          const q = query(videosCol, where('creatorId', '==', uid));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach(videoDoc => {
            batch.update(videoDoc.ref, { isVerifiedCreator: !user.isVerified });
          });
          await batch.commit();
          break;
        case 'live':
          await updateDoc(userRef, { canGoLive: !user.canGoLive });
          break;
        case 'admin':
          await updateDoc(userRef, { isAdmin: !user.isAdmin });
          break;
        case 'coins':
          await updateDoc(userRef, { coins: increment(100) });
          break;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-black z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button onClick={onBack} className="p-1 hover:bg-zinc-800 rounded-full text-white">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-1">
          <h3 className="text-white font-bold">{user?.displayName}</h3>
          {(user?.isAdmin || user?.role === 'admin') && (
            <Shield size={16} className="text-blue-400 fill-blue-400" />
          )}
          {user?.isVerified && <CheckCircle size={16} className="text-blue-400 fill-blue-400" />}
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Info */}
        <div className="flex flex-col items-center p-8">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-zinc-800 relative">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-full h-full text-zinc-500 p-4" />
            )}
            {user?.isBanned && (
              <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                <Ban size={48} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-bold text-xl">@{user?.username}</h2>
            {isOwnProfile && (
              <button 
                onClick={() => setShowAdminCode(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors group"
              >
                <Shield size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Admin</span>
              </button>
            )}
            {user?.isVerified && <CheckCircle size={20} className="text-blue-400 fill-blue-400" />}
          </div>
          <p className="text-zinc-400 text-sm mb-4">{user?.bio}</p>

          {user?.externalLinks && (
            <div className="flex gap-4 mb-6">
              {user.externalLinks.tiktok && (
                <a href={`https://${user.externalLinks.tiktok}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <VideoIcon size={20} />
                </a>
              )}
              {user.externalLinks.instagram && (
                <a href={`https://${user.externalLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <Instagram size={20} />
                </a>
              )}
              {user.externalLinks.youtube && (
                <a href={`https://${user.externalLinks.youtube}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <Youtube size={20} />
                </a>
              )}
              {user.externalLinks.twitter && (
                <a href={`https://${user.externalLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <Twitter size={20} />
                </a>
              )}
              {user.externalLinks.website && (
                <a href={`https://${user.externalLinks.website}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <Globe size={20} />
                </a>
              )}
            </div>
          )}

          {user?.warnings && user.warnings > 0 && (
            <div className="flex items-center gap-1 text-yellow-500 text-xs mb-4">
              <AlertTriangle size={14} />
              <span>{user.warnings} Warnings</span>
            </div>
          )}

          <div className="flex gap-8 mb-8">
            <div className="flex flex-col items-center">
              <span className="text-white font-bold">{user?.followingCount || 0}</span>
              <span className="text-zinc-500 text-xs">Following</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold">{user?.followersCount || 0}</span>
              <span className="text-zinc-500 text-xs">Followers</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold">{user?.coins || 0}</span>
              <span className="text-zinc-500 text-xs">Coins</span>
            </div>
          </div>

          {isOwnProfile ? (
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full bg-zinc-800 text-white font-bold py-3 rounded-md hover:bg-zinc-700 transition-colors"
              >
                Edit Profile
              </button>
              {currentUserData?.isAdmin && (
                <button 
                  onClick={onOpenAdminPanel}
                  className="w-full bg-blue-500/10 text-blue-400 font-bold py-3 rounded-md hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Shield size={18} />
                  Open Admin Panel
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {currentUserData?.isAdmin ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button 
                    onClick={() => handleAdminAction('verify')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-colors ${user?.isVerified ? 'bg-zinc-800 text-blue-400' : 'bg-blue-500 text-white'}`}
                  >
                    <CheckCircle size={16} />
                    {user?.isVerified ? 'Unverify' : 'Verify'}
                  </button>
                  <button 
                    onClick={() => handleAdminAction('admin')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-colors ${user?.isAdmin ? 'bg-zinc-800 text-purple-400' : 'bg-purple-500 text-white'}`}
                  >
                    <Shield size={16} />
                    {user?.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                  </button>
                  <button 
                    onClick={() => handleAdminAction('coins')}
                    className="flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm bg-yellow-500 text-black transition-colors"
                  >
                    <Heart size={16} className="fill-current" />
                    +100 Coins
                  </button>
                  <button 
                    onClick={() => handleAdminAction('warn')}
                    className="flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm bg-yellow-500 text-black transition-colors"
                  >
                    <AlertTriangle size={16} />
                    Warn
                  </button>
                  <button 
                    onClick={() => handleAdminAction('suspend')}
                    className="flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm bg-orange-500 text-white transition-colors"
                  >
                    <Clock size={16} />
                    Suspend
                  </button>
                  <button 
                    onClick={() => handleAdminAction('live')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-colors ${user?.canGoLive ? 'bg-zinc-800 text-red-500' : 'bg-green-500 text-white'}`}
                  >
                    <VideoIcon size={16} />
                    {user?.canGoLive ? 'Revoke Live' : 'Grant Live'}
                  </button>
                  <button 
                    onClick={() => handleAdminAction('ban')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-colors col-span-2 ${user?.isBanned ? 'bg-zinc-800 text-red-500' : 'bg-red-500 text-white'}`}
                  >
                    <Ban size={16} />
                    {user?.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={handleFollow}
                    className={`flex-1 font-bold py-3 rounded-md transition-colors ${isFollowing ? 'bg-zinc-800 text-white' : 'bg-red-500 text-white hover:bg-red-600'}`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  {isMutualFollow && (
                    <button 
                      onClick={() => onOpenChat?.(uid)}
                      className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-md hover:bg-zinc-700 transition-colors"
                    >
                      Message
                    </button>
                  )}
                </div>
              )}
              <button 
                onClick={handleReportUser}
                className="w-full flex items-center justify-center gap-2 py-2 text-zinc-500 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <Flag size={14} />
                Report User
              </button>
            </div>
          )}
        </div>

        {/* Edit Profile Modal */}
        <AnimatePresence>
          {isEditing && (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-zinc-800 rounded-full text-white">
                  <X size={24} />
                </button>
                <h3 className="text-white font-bold">Edit Profile</h3>
                <button 
                  onClick={handleSaveProfile}
                  className="text-blue-400 font-bold"
                >
                  Save
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={40} className="text-zinc-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Camera size={24} className="text-white" />
                    </div>
                  </div>
                  <button className="text-blue-400 text-sm font-bold">Change Photo</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-zinc-500 text-xs font-bold uppercase mb-1 block">Display Name</label>
                    <input 
                      type="text" 
                      value={editData.displayName}
                      onChange={(e) => setEditData({...editData, displayName: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs font-bold uppercase mb-1 block">Bio</label>
                    <textarea 
                      value={editData.bio}
                      onChange={(e) => setEditData({...editData, bio: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none h-24 resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-white font-bold text-sm mb-4">External Links</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <VideoIcon size={20} />
                        </div>
                        <div className="flex-1">
                          <label className="text-zinc-500 text-[10px] font-bold uppercase block">TikTok</label>
                          <input 
                            type="text" 
                            placeholder="tiktok.com/@username"
                            value={editData.externalLinks.tiktok}
                            onChange={(e) => setEditData({
                              ...editData, 
                              externalLinks: { ...editData.externalLinks, tiktok: e.target.value }
                            })}
                            className="w-full bg-transparent border-b border-zinc-800 py-1 text-white focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Instagram size={20} />
                        </div>
                        <div className="flex-1">
                          <label className="text-zinc-500 text-[10px] font-bold uppercase block">Instagram</label>
                          <input 
                            type="text" 
                            placeholder="instagram.com/username"
                            value={editData.externalLinks.instagram}
                            onChange={(e) => setEditData({
                              ...editData, 
                              externalLinks: { ...editData.externalLinks, instagram: e.target.value }
                            })}
                            className="w-full bg-transparent border-b border-zinc-800 py-1 text-white focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Youtube size={20} />
                        </div>
                        <div className="flex-1">
                          <label className="text-zinc-500 text-[10px] font-bold uppercase block">YouTube</label>
                          <input 
                            type="text" 
                            placeholder="youtube.com/@channel"
                            value={editData.externalLinks.youtube}
                            onChange={(e) => setEditData({
                              ...editData, 
                              externalLinks: { ...editData.externalLinks, youtube: e.target.value }
                            })}
                            className="w-full bg-transparent border-b border-zinc-800 py-1 text-white focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Twitter size={20} />
                        </div>
                        <div className="flex-1">
                          <label className="text-zinc-500 text-[10px] font-bold uppercase block">Twitter / X</label>
                          <input 
                            type="text" 
                            placeholder="twitter.com/username"
                            value={editData.externalLinks.twitter}
                            onChange={(e) => setEditData({
                              ...editData, 
                              externalLinks: { ...editData.externalLinks, twitter: e.target.value }
                            })}
                            className="w-full bg-transparent border-b border-zinc-800 py-1 text-white focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Globe size={20} />
                        </div>
                        <div className="flex-1">
                          <label className="text-zinc-500 text-[10px] font-bold uppercase block">Website</label>
                          <input 
                            type="text" 
                            placeholder="yourwebsite.com"
                            value={editData.externalLinks.website}
                            onChange={(e) => setEditData({
                              ...editData, 
                              externalLinks: { ...editData.externalLinks, website: e.target.value }
                            })}
                            className="w-full bg-transparent border-b border-zinc-800 py-1 text-white focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-white font-bold text-sm border-b border-zinc-800 pb-2">External Links</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <VideoIcon size={18} className="text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="TikTok Link"
                        value={editData.externalLinks.tiktok}
                        onChange={(e) => setEditData({...editData, externalLinks: {...editData.externalLinks, tiktok: e.target.value}})}
                        className="bg-transparent border-none outline-none text-sm text-white flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <Instagram size={18} className="text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Instagram Link"
                        value={editData.externalLinks.instagram}
                        onChange={(e) => setEditData({...editData, externalLinks: {...editData.externalLinks, instagram: e.target.value}})}
                        className="bg-transparent border-none outline-none text-sm text-white flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <Youtube size={18} className="text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="YouTube Link"
                        value={editData.externalLinks.youtube}
                        onChange={(e) => setEditData({...editData, externalLinks: {...editData.externalLinks, youtube: e.target.value}})}
                        className="bg-transparent border-none outline-none text-sm text-white flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <Twitter size={18} className="text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Twitter Link"
                        value={editData.externalLinks.twitter}
                        onChange={(e) => setEditData({...editData, externalLinks: {...editData.externalLinks, twitter: e.target.value}})}
                        className="bg-transparent border-none outline-none text-sm text-white flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <Globe size={18} className="text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Website Link"
                        value={editData.externalLinks.website}
                        onChange={(e) => setEditData({...editData, externalLinks: {...editData.externalLinks, website: e.target.value}})}
                        className="bg-transparent border-none outline-none text-sm text-white flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showAdminCode && (
            <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-full max-w-sm"
              >
                <h3 className="text-xl font-bold mb-4">Enter Admin Code</h3>
                <form onSubmit={handleAdminCodeSubmit}>
                  <input 
                    type="password" 
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-4 text-white"
                    placeholder="Code"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowAdminCode(false)}
                      className="flex-1 py-2 bg-zinc-800 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2 bg-blue-500 rounded-lg font-bold"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 flex justify-center py-3 ${activeTab === 'videos' ? 'text-white border-b-2 border-white' : 'text-zinc-500'}`}
          >
            <Grid size={24} />
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-1 flex justify-center py-3 ${activeTab === 'liked' ? 'text-white border-b-2 border-white' : 'text-zinc-500'}`}
          >
            <Lock size={24} />
          </button>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {activeTab === 'videos' ? (
            videos.length > 0 ? (
              videos.map(video => (
                <div 
                  key={video.id} 
                  className="aspect-[3/4] bg-zinc-900 relative cursor-pointer group overflow-hidden"
                  onClick={() => onVideoClick(video)}
                >
                  <video src={video.videoUrl} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-white text-xs font-bold">▶ {video.likesCount}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-20 flex flex-col items-center justify-center text-zinc-500">
                <Grid size={48} className="mb-2 opacity-20" />
                <p>No videos yet</p>
              </div>
            )
          ) : (
            <div className="col-span-3 py-20 flex flex-col items-center justify-center text-zinc-500">
              <Lock size={48} className="mb-2 opacity-20" />
              <p>This user's liked videos are private</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
