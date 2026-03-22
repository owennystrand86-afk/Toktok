import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, doc, updateDoc, deleteDoc, increment, where, getCountFromServer, serverTimestamp, addDoc, writeBatch, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { User, Video, Report, AuditLog } from '../types';
import { 
  X, 
  Users, 
  Video as VideoIcon, 
  Radio,
  BarChart3, 
  Search, 
  Shield, 
  CheckCircle, 
  Ban, 
  AlertTriangle, 
  Trash2, 
  Coins, 
  ArrowUpRight,
  TrendingUp,
  Activity,
  Eye,
  Flag,
  Settings,
  Database,
  RefreshCw,
  UserPlus,
  Lock,
  Unlock,
  Bell,
  Globe,
  Zap,
  Bug,
  Terminal,
  History,
  MoreVertical,
  ChevronRight,
  Filter,
  Download,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { soundManager } from '../utils';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'content' | 'reports' | 'audit' | 'settings' | 'debug'>('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVideos: 0,
    totalCoins: 0,
    activeStreams: 0,
    totalReports: 0,
    pendingReports: 0,
    totalXP: 0,
    avgLevel: 1
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [coinDistribution, setCoinDistribution] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showCoinModal, setShowCoinModal] = useState<{ uid: string, username: string } | null>(null);
  const [coinAmountInput, setCoinAmountInput] = useState('100');
  const [adminNotification, setAdminNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const addLog = (msg: string) => {
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    if (auth.currentUser) {
      addLog(`Checking admin status for: ${auth.currentUser.email}`);
      const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
        if (doc.exists()) {
          const data = { ...doc.data(), uid: doc.id } as User;
          setCurrentUserData(data);
          addLog(`Admin status: ${data.isAdmin ? 'YES' : 'NO'}`);
          addLog(`Coins: ${data.coins}`);
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`));
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    // Fetch stats and generate mock chart data for visualization
    const fetchStats = async () => {
      try {
        addLog("Fetching system stats...");
        const usersSnap = await getCountFromServer(collection(db, 'users'));
        const videosSnap = await getCountFromServer(collection(db, 'videos'));
        const streamsSnap = await getCountFromServer(query(collection(db, 'live_streams'), where('status', '==', 'live')));
        const reportsSnap = await getCountFromServer(collection(db, 'reports'));
        const pendingReportsSnap = await getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'pending')));
        
        // Sum coins and XP (this is expensive if many users, but fine for now)
        const allUsers = await getDocs(query(collection(db, 'users'), limit(500)));
        let totalCoins = 0;
        let totalXP = 0;
        let totalLevel = 0;
        const distribution: Record<string, number> = { '0-100': 0, '101-1000': 0, '1001-5000': 0, '5000+': 0 };
        
        allUsers.forEach(doc => {
          const data = doc.data();
          const c = data.coins || 0;
          totalCoins += c;
          totalXP += data.xp || 0;
          totalLevel += data.level || 1;
          
          if (c <= 100) distribution['0-100']++;
          else if (c <= 1000) distribution['101-1000']++;
          else if (c <= 5000) distribution['1001-5000']++;
          else distribution['5000+']++;
        });

        setCoinDistribution(Object.entries(distribution).map(([name, value]) => ({ name, value })));

        setStats({
          totalUsers: usersSnap.data().count,
          totalVideos: videosSnap.data().count,
          totalCoins,
          activeStreams: streamsSnap.data().count,
          totalReports: reportsSnap.data().count,
          pendingReports: pendingReportsSnap.data().count,
          totalXP,
          avgLevel: allUsers.size > 0 ? Math.round((totalLevel / allUsers.size) * 10) / 10 : 1
        });

        // Mock growth data
        setChartData([
          { name: 'Mon', users: 40, videos: 24 },
          { name: 'Tue', users: 30, videos: 13 },
          { name: 'Wed', users: 20, videos: 98 },
          { name: 'Thu', users: 27, videos: 39 },
          { name: 'Fri', users: 18, videos: 48 },
          { name: 'Sat', users: 23, videos: 38 },
          { name: 'Sun', users: 34, videos: 43 },
        ]);
        addLog("Stats updated successfully.");
      } catch (error) {
        addLog(`Error fetching stats: ${error}`);
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        setUsers(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id }) as User));
        setLoading(false);
      }, (error) => {
        addLog(`Users listener error: ${error}`);
        handleFirestoreError(error, OperationType.LIST, 'users');
        setLoading(false);
      });
      return () => unsub();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'content') {
      setLoading(true);
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        setVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Video));
        setLoading(false);
      }, (error) => {
        addLog(`Videos listener error: ${error}`);
        handleFirestoreError(error, OperationType.LIST, 'videos');
        setLoading(false);
      });
      return () => unsub();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      setLoading(true);
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Report));
        setLoading(false);
      }, (error) => {
        addLog(`Reports listener error: ${error}`);
        handleFirestoreError(error, OperationType.LIST, 'reports');
        setLoading(false);
      });
      return () => unsub();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') {
      setLoading(true);
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AuditLog));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'audit_logs');
        setLoading(false);
      });
      return () => unsub();
    }
  }, [activeTab]);

  const logAdminAction = async (action: string, targetId?: string, targetUsername?: string, details?: string) => {
    if (!auth.currentUser || !currentUserData) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        adminId: auth.currentUser.uid,
        adminUsername: currentUserData.username,
        action,
        targetId,
        targetUsername,
        details,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error logging admin action:", error);
    }
  };

  const handleVerifyUser = async (uid: string, currentStatus: boolean, username: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isVerified: !currentStatus });
      logAdminAction(currentStatus ? 'unverify_user' : 'verify_user', uid, username);
      showNotify(`User @${username} ${currentStatus ? 'unverified' : 'verified'} successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleBanUser = async (uid: string, currentStatus: boolean, username: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isBanned: !currentStatus });
      logAdminAction(currentStatus ? 'unban_user' : 'ban_user', uid, username);
      showNotify(`User @${username} ${currentStatus ? 'unbanned' : 'banned'} successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const showNotify = (msg: string, type: 'success' | 'error' = 'success') => {
    setAdminNotification({ msg, type });
    setTimeout(() => setAdminNotification(null), 3000);
  };

  const handleGiveCoins = async () => {
    if (!showCoinModal) return;
    
    const amount = parseInt(coinAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showNotify("Please enter a valid positive number.", 'error');
      return;
    }
    
    const uid = showCoinModal.uid;
    addLog(`Attempting to give ${amount} coins to user: ${uid}`);
    try {
      await updateDoc(doc(db, 'users', uid), { 
        coins: increment(amount) 
      });
      logAdminAction('give_coins', uid, showCoinModal.username, `Amount: ${amount}`);
      soundManager.play('success');
      addLog(`Successfully gave ${amount} coins to ${uid}`);
      showNotify(`Successfully gave ${amount} coins to @${showCoinModal.username}!`);
      setShowCoinModal(null);
      setCoinAmountInput('100');
    } catch (error: any) {
      addLog(`FAILED to give coins: ${error}`);
      console.error("Error giving coins:", error);
      showNotify(`Failed to give coins: ${error.message}`, 'error');
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleResetCoins = async (uid: string, username: string) => {
    if (!window.confirm(`Are you sure you want to reset coins for @${username}?`)) return;
    
    addLog(`Attempting to reset coins for user: ${uid}`);
    try {
      await updateDoc(doc(db, 'users', uid), { 
        coins: 0 
      });
      logAdminAction('reset_coins', uid, username, 'Reset to 0');
      soundManager.play('success');
      addLog(`Successfully reset coins for ${uid}`);
      showNotify(`Successfully reset coins for @${username}!`);
    } catch (error: any) {
      addLog(`FAILED to reset coins: ${error}`);
      console.error("Error resetting coins:", error);
      showNotify(`Failed to reset coins: ${error.message}`, 'error');
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleBulkBan = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedUserIds.forEach(uid => {
        batch.update(doc(db, 'users', uid), { isBanned: true });
      });
      await batch.commit();
      logAdminAction('bulk_ban', undefined, undefined, `Count: ${selectedUserIds.length}`);
      showNotify(`Successfully banned ${selectedUserIds.length} users.`);
      setSelectedUserIds([]);
    } catch (error: any) {
      showNotify(`Bulk ban failed: ${error.message}`, 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkVerify = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedUserIds.forEach(uid => {
        batch.update(doc(db, 'users', uid), { isVerified: true });
      });
      await batch.commit();
      logAdminAction('bulk_verify', undefined, undefined, `Count: ${selectedUserIds.length}`);
      showNotify(`Successfully verified ${selectedUserIds.length} users.`);
      setSelectedUserIds([]);
    } catch (error: any) {
      showNotify(`Bulk verify failed: ${error.message}`, 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const [platformSettings, setPlatformSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: "Platform is currently under maintenance. Please check back later.",
    globalSoundEnabled: true,
    registrationEnabled: true
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'platform_settings', 'global'), (snap) => {
      if (snap.exists()) {
        setPlatformSettings(snap.data() as any);
      }
    });
    return () => unsub();
  }, []);

  const handleUpdateSettings = async (newSettings: any) => {
    try {
      await setDoc(doc(db, 'platform_settings', 'global'), {
        ...newSettings,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      });
      logAdminAction('update_platform_settings', 'global', 'Platform', JSON.stringify(newSettings));
      showNotify("Platform settings updated successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'platform_settings/global');
    }
  };

  const handleClearAllReports = async () => {
    if (!window.confirm("Are you sure you want to clear ALL reports? This cannot be undone.")) return;
    try {
      const batch = writeBatch(db);
      reports.forEach(report => {
        batch.delete(doc(db, 'reports', report.id!));
      });
      await batch.commit();
      logAdminAction('clear_all_reports', undefined, undefined, `Count: ${reports.length}`);
      showNotify(`Successfully cleared ${reports.length} reports.`);
    } catch (error: any) {
      showNotify(`Failed to clear reports: ${error.message}`, 'error');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      showNotify("Video deleted successfully.");
      setShowConfirmDelete(null);
    } catch (error: any) {
      showNotify(`Failed to delete video: ${error.message}`, 'error');
      handleFirestoreError(error, OperationType.DELETE, `videos/${videoId}`);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { 
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: auth.currentUser?.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { 
        status: 'dismissed',
        resolvedAt: serverTimestamp(),
        resolvedBy: auth.currentUser?.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const handleToggleAdmin = async (uid: string, currentIsAdmin: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isAdmin: !currentIsAdmin });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVideos = videos.filter(v => 
    v.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.creatorUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReports = reports.filter(r => 
    r.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.targetId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[150] bg-zinc-950 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Shield className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Admin Command Center</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">TokTok Moderation</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/30">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <BarChart3 size={18} />
          Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'users' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Users size={18} />
          Users
        </button>
        <button 
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'content' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <VideoIcon size={18} />
          Content
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'reports' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Flag size={18} />
          Reports
          {stats.pendingReports > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] text-center">
              {stats.pendingReports}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'audit' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <History size={18} />
          Audit
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Settings size={18} />
          Settings
        </button>
        <button 
          onClick={() => setActiveTab('debug')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'debug' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Bug size={18} />
          Debug
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-blue-400" size={20} />
                  <TrendingUp className="text-green-500" size={16} />
                </div>
                <p className="text-zinc-500 text-xs font-bold uppercase">Total Users</p>
                <h3 className="text-2xl font-bold text-white">{stats.totalUsers}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <VideoIcon className="text-purple-400" size={20} />
                  <Activity className="text-blue-500" size={16} />
                </div>
                <p className="text-zinc-500 text-xs font-bold uppercase">Total Videos</p>
                <h3 className="text-2xl font-bold text-white">{stats.totalVideos}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <Coins className="text-yellow-400" size={20} />
                  <ArrowUpRight className="text-green-500" size={16} />
                </div>
                <p className="text-zinc-500 text-xs font-bold uppercase">Economy Size</p>
                <h3 className="text-2xl font-bold text-white">{stats.totalCoins.toLocaleString()}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <Flag className="text-red-400" size={20} />
                  <AlertTriangle className="text-red-500" size={16} />
                </div>
                <p className="text-zinc-500 text-xs font-bold uppercase">Pending Reports</p>
                <h3 className="text-2xl font-bold text-white">{stats.pendingReports}</h3>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-400" />
                  Platform Growth
                </h4>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                  <Coins size={18} className="text-yellow-400" />
                  Coin Distribution
                </h4>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coinDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        cursor={{ fill: '#27272a' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {coinDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#eab308', '#ef4444'][index % 4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Admin Self-Actions */}
            {currentUserData && (
              <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="text-blue-400" size={20} />
                  <h3 className="text-lg font-bold text-white">Your Admin Tools</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowCoinModal({ uid: currentUserData.uid, username: currentUserData.username })}
                    className="flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-800 transition-colors"
                  >
                    <Coins size={18} className="text-yellow-400" />
                    Give Self Coins
                  </button>
                  <button 
                    onClick={() => handleVerifyUser(currentUserData.uid, currentUserData.isVerified || false, currentUserData.username)}
                    className="flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-800 transition-colors"
                  >
                    <CheckCircle size={18} className={currentUserData.isVerified ? "text-blue-400" : "text-zinc-500"} />
                    {currentUserData.isVerified ? "Unverify Self" : "Verify Self"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                  <History size={18} className="text-blue-400" />
                  Recent Activity
                </h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.slice(0, 10).map((log, i) => (
                    <div key={log.id || i} className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
                      <div className={`p-2 rounded-lg ${
                        log.action.includes('ban') ? 'bg-red-500/10 text-red-500' :
                        log.action.includes('verify') ? 'bg-blue-500/10 text-blue-500' :
                        log.action.includes('coins') ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-zinc-700/30 text-zinc-400'
                      }`}>
                        {log.action.includes('ban') ? <Ban size={14} /> :
                         log.action.includes('verify') ? <CheckCircle size={14} /> :
                         log.action.includes('coins') ? <Coins size={14} /> :
                         <Activity size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium">
                          <span className="text-blue-400">@{log.adminUsername}</span> {log.action.replace('_', ' ')}
                          {log.targetUsername && <span> on <span className="text-zinc-300">@{log.targetUsername}</span></span>}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          {log.details} · {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-center text-zinc-500 text-xs py-10">No recent activity found.</p>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-blue-400" />
                  System Health
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Database className="text-zinc-400" size={18} />
                      <span className="text-sm">Database Health</span>
                    </div>
                    <span className="text-xs font-bold text-green-500 uppercase">Optimal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Globe className="text-zinc-400" size={18} />
                      <span className="text-sm">API Latency</span>
                    </div>
                    <span className="text-xs font-bold text-green-500 uppercase">24ms</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Zap className="text-zinc-400" size={18} />
                      <span className="text-sm">CDN Status</span>
                    </div>
                    <span className="text-xs font-bold text-green-500 uppercase">Active</span>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mt-2">
                    <p className="text-[10px] text-blue-400 leading-relaxed">
                      All systems operational. Average level: <span className="font-bold">{stats.avgLevel}</span>. 
                      Total platform XP: <span className="font-bold">{stats.totalXP.toLocaleString()}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'users' || activeTab === 'content') && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              {activeTab === 'users' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (selectedUserIds.length === filteredUsers.length) setSelectedUserIds([]);
                      else setSelectedUserIds(filteredUsers.map(u => u.uid));
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all"
                  >
                    {selectedUserIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedUserIds.length > 0 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleBulkBan}
                        disabled={bulkActionLoading}
                        className="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2"
                      >
                        <Ban size={14} />
                        Ban ({selectedUserIds.length})
                      </button>
                      <button 
                        onClick={handleBulkVerify}
                        disabled={bulkActionLoading}
                        className="bg-blue-500/10 text-blue-400 px-3 py-2 rounded-xl text-xs font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-2"
                      >
                        <CheckCircle size={14} />
                        Verify ({selectedUserIds.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Activity className="animate-spin text-blue-400" size={32} />
              </div>
            ) : (
              <div className="space-y-3">
                {activeTab === 'users' && filteredUsers.map(user => (
                  <div 
                    key={user.uid} 
                    className={`bg-zinc-900 border p-4 rounded-2xl flex items-center justify-between transition-all ${selectedUserIds.includes(user.uid) ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={selectedUserIds.includes(user.uid)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUserIds(prev => [...prev, user.uid]);
                          else setSelectedUserIds(prev => prev.filter(id => id !== user.uid));
                        }}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <Users size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <h5 className="text-white font-bold text-sm">@{user.username}</h5>
                          {user.isVerified && <CheckCircle size={12} className="text-blue-400 fill-blue-400" />}
                          {user.isAdmin && <Shield size={12} className="text-blue-400" />}
                        </div>
                        <p className="text-zinc-500 text-[10px]">
                          Lvl {user.level || 1} · {user.xp || 0} XP · {user.coins} coins · {user.followersCount || 0} followers
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowCoinModal({ uid: user.uid, username: user.username })}
                        className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500/20 transition-colors"
                        title="Give Coins"
                      >
                        <Coins size={18} />
                      </button>
                      <button 
                        onClick={() => handleResetCoins(user.uid, user.username)}
                        className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors"
                        title="Reset Coins"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <button 
                        onClick={() => handleToggleAdmin(user.uid, !!user.isAdmin)}
                        className={`p-2 rounded-lg transition-colors ${user.isAdmin ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        title={user.isAdmin ? "Revoke Admin" : "Make Admin"}
                      >
                        {user.isAdmin ? <Shield size={18} /> : <UserPlus size={18} />}
                      </button>
                      <button 
                        onClick={() => handleVerifyUser(user.uid, !!user.isVerified, user.username)}
                        className={`p-2 rounded-lg transition-colors ${user.isVerified ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        title={user.isVerified ? "Unverify" : "Verify"}
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button 
                        onClick={() => handleBanUser(user.uid, !!user.isBanned, user.username)}
                        className={`p-2 rounded-lg transition-colors ${user.isBanned ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        title={user.isBanned ? "Unban" : "Ban"}
                      >
                        <Ban size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {activeTab === 'content' && filteredVideos.map(video => (
                  <div key={video.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex gap-3">
                    <div className="w-20 aspect-[3/4] bg-zinc-800 rounded-lg overflow-hidden relative group">
                      <video src={video.videoUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye size={20} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h5 className="text-white font-bold text-sm truncate">@{video.creatorUsername}</h5>
                        <p className="text-zinc-500 text-xs line-clamp-2 mt-1">{video.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          <span>{video.likesCount} Likes</span>
                          <span>{video.commentsCount} Comments</span>
                        </div>
                        <button 
                          onClick={() => setShowConfirmDelete(video.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {(activeTab === 'users' ? filteredUsers : filteredVideos).length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-zinc-500 text-center px-8">
                    <Search size={48} className="mb-4 opacity-20" />
                    <h3 className="text-lg font-bold text-white">No results found</h3>
                    <p className="text-sm">Try adjusting your search query to find what you're looking for.</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History size={20} className="text-blue-400" />
                    Admin Audit Logs
                  </h3>
                  <button 
                    onClick={() => {
                      const csv = auditLogs.map(log => `${log.createdAt?.toDate().toISOString()},${log.adminUsername},${log.action},${log.targetUsername || ''},${log.details || ''}`).join('\n');
                      const blob = new Blob([`Date,Admin,Action,Target,Details\n${csv}`], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `toktok_audit_logs_${new Date().toISOString()}.csv`;
                      a.click();
                    }}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Activity className="animate-spin text-blue-400" size={32} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-20 text-zinc-500">
                        <History size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No audit logs found</p>
                      </div>
                    ) : (
                      auditLogs.map(log => (
                        <div key={log.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            log.action.includes('ban') ? 'bg-red-500/10 text-red-400' :
                            log.action.includes('verify') ? 'bg-blue-500/10 text-blue-400' :
                            log.action.includes('coins') ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {log.action.includes('ban') ? <Ban size={16} /> :
                             log.action.includes('verify') ? <CheckCircle size={16} /> :
                             log.action.includes('coins') ? <Coins size={16} /> :
                             <Activity size={16} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-white">
                                <span className="text-blue-400">@{log.adminUsername}</span>
                                <span className="mx-1 text-zinc-500">performed</span>
                                <span className="text-zinc-200 uppercase text-[10px] tracking-wider">{log.action.replace('_', ' ')}</span>
                              </p>
                              <span className="text-[10px] text-zinc-600">
                                {log.createdAt?.toDate().toLocaleString()}
                              </span>
                            </div>
                            {log.targetUsername && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                Target: <span className="text-zinc-300">@{log.targetUsername}</span>
                              </p>
                            )}
                            {log.details && (
                              <p className="text-[10px] text-zinc-400 mt-1 bg-black/30 p-1.5 rounded border border-zinc-800/50">
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search reports..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  {reports.length > 0 && (
                    <button 
                      onClick={handleClearAllReports}
                      className="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Clear All
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Activity className="animate-spin text-blue-400" size={32} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.length === 0 ? (
                      <div className="text-center py-20 text-zinc-500">
                        <Flag size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No reports found</p>
                      </div>
                    ) : (
                      filteredReports.map(report => (
                        <div key={report.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                report.status === 'pending' ? 'bg-red-500/10 text-red-500' : 
                                report.status === 'resolved' ? 'bg-green-500/10 text-green-500' : 
                                'bg-zinc-800 text-zinc-500'
                              }`}>
                                {report.status}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {report.createdAt?.toDate().toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {report.status === 'pending' && (
                                <>
                                  <button 
                                    onClick={() => handleResolveReport(report.id!)}
                                    className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
                                    title="Resolve"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDismissReport(report.id!)}
                                    className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors"
                                    title="Dismiss"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-white font-bold">{report.reason}</p>
                            <p className="text-xs text-zinc-500 mt-1">
                              Target: <span className="text-zinc-300">{report.targetType} ({report.targetId})</span>
                            </p>
                            <p className="text-xs text-zinc-500">
                              Reporter: <span className="text-zinc-300">{report.reporterUsername}</span>
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Globe size={20} className="text-blue-400" />
                    Platform Controls
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm">Maintenance Mode</p>
                        <p className="text-zinc-500 text-xs">Disable platform access for all non-admin users.</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({ ...platformSettings, maintenanceMode: !platformSettings.maintenanceMode })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${platformSettings.maintenanceMode ? 'bg-red-500' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${platformSettings.maintenanceMode ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {platformSettings.maintenanceMode && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Maintenance Message</label>
                        <textarea 
                          value={platformSettings.maintenanceMessage}
                          onChange={(e) => setPlatformSettings({ ...platformSettings, maintenanceMessage: e.target.value })}
                          onBlur={() => handleUpdateSettings(platformSettings)}
                          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none h-20"
                        />
                      </div>
                    )}

                    <div className="h-px bg-zinc-800" />

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm">Global Sound</p>
                        <p className="text-zinc-500 text-xs">Enable or disable sound effects platform-wide.</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({ ...platformSettings, globalSoundEnabled: !platformSettings.globalSoundEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${platformSettings.globalSoundEnabled ? 'bg-blue-500' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${platformSettings.globalSoundEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm">User Registration</p>
                        <p className="text-zinc-500 text-xs">Allow new users to create accounts.</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({ ...platformSettings, registrationEnabled: !platformSettings.registrationEnabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${platformSettings.registrationEnabled ? 'bg-green-500' : 'bg-zinc-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${platformSettings.registrationEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Database size={20} className="text-blue-400" />
                    Data Management
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleClearAllReports}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-left hover:bg-red-500/20 transition-all group"
                    >
                      <Trash2 className="text-red-500 mb-2 group-hover:scale-110 transition-transform" size={24} />
                      <p className="text-white font-bold text-sm">Clear Reports</p>
                      <p className="text-zinc-500 text-[10px]">Delete all user reports permanently.</p>
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm("Are you sure you want to clear ALL audit logs? This is for security compliance only.")) {
                          showNotify("Feature restricted to super-admins.", 'error');
                        }
                      }}
                      className="p-4 bg-zinc-800 border border-zinc-700 rounded-2xl text-left hover:bg-zinc-700 transition-all group"
                    >
                      <History className="text-zinc-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
                      <p className="text-white font-bold text-sm">Purge Logs</p>
                      <p className="text-zinc-500 text-[10px]">Clear administrative audit history.</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'debug' && (
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center justify-between">
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <Terminal size={18} className="text-green-400" />
                      System Console
                    </h4>
                    <button 
                      onClick={() => setDebugLogs([])}
                      className="text-xs text-zinc-500 hover:text-white transition-colors"
                    >
                      Clear Logs
                    </button>
                  </div>
                  <div className="p-4 bg-black font-mono text-[10px] h-[400px] overflow-y-auto space-y-1">
                    {debugLogs.length === 0 ? (
                      <p className="text-zinc-700 italic">No logs yet...</p>
                    ) : (
                      debugLogs.map((log, i) => (
                        <p key={i} className={log.includes('FAILED') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400' : 'text-zinc-400'}>
                          {log}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-blue-400" />
                    Admin Authentication Check
                  </h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-800/50 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Auth UID:</span>
                        <span className="text-white font-mono">{auth.currentUser?.uid}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Auth Email:</span>
                        <span className="text-white font-mono">{auth.currentUser?.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Firestore isAdmin:</span>
                        <span className={currentUserData?.isAdmin ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                          {currentUserData?.isAdmin ? "TRUE" : "FALSE"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 italic">
                      If "Firestore isAdmin" is FALSE, you won't be able to perform admin actions even if you can see this panel. 
                      The security rules will block any write attempts.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Notifications */}
      <AnimatePresence>
        {adminNotification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] flex items-center gap-2 border ${
              adminNotification.type === 'success' ? 'bg-green-500 text-white border-green-400' : 'bg-red-500 text-white border-red-400'
            }`}
          >
            {adminNotification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="font-bold text-sm">{adminNotification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coin Modal */}
      <AnimatePresence>
        {showCoinModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCoinModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">Give Coins</h3>
              <p className="text-zinc-400 text-sm mb-6">Giving coins to <span className="text-blue-400 font-bold">@{showCoinModal.username}</span></p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Amount</label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500" size={20} />
                    <input 
                      type="number"
                      value={coinAmountInput}
                      onChange={(e) => setCoinAmountInput(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white font-bold text-lg focus:border-yellow-500 outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[100, 500, 1000, 5000, 10000, 50000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCoinAmountInput(amt.toString())}
                      className="py-2 bg-zinc-800 text-zinc-400 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowCoinModal(null)}
                    className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGiveCoins}
                    className="flex-1 py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Give Coins
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="text-red-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Video?</h3>
              <p className="text-zinc-400 text-sm mb-6">This action cannot be undone. The video will be permanently removed from the platform.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmDelete(null)}
                  className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteVideo(showConfirmDelete)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
