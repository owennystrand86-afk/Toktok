export interface User {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
  bio: string;
  createdAt: any;
  role?: 'admin' | 'user';
  isVerified?: boolean;
  isBanned?: boolean;
  isSuspendedUntil?: any;
  warnings?: number;
  hasAcceptedTerms?: boolean;
  coins?: number;
  xp?: number;
  level?: number;
  lastDailyClaim?: any;
  followersCount?: number;
  followingCount?: number;
  isAdmin?: boolean;
  canGoLive?: boolean;
  externalLinks?: {
    tiktok?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
    website?: string;
  };
}

export interface Report {
  id: string;
  reporterId: string;
  reporterUsername: string;
  targetId: string; // userId or videoId
  targetType: 'user' | 'video' | 'comment';
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: any;
  details?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
}

export interface LiveStream {
  id: string;
  hostId: string;
  hostUsername: string;
  hostPhotoURL: string;
  viewerCount: number;
  isActive: boolean;
  createdAt: any;
}

export interface Video {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorPhotoURL: string;
  videoUrl: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: any;
  isVerifiedCreator?: boolean;
  isAdminCreator?: boolean;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  username: string;
  userPhotoURL: string;
  text: string;
  createdAt: any;
}

export interface Like {
  videoId: string;
  userId: string;
  createdAt: any;
}

export interface AuditLog {
  id?: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetId?: string;
  targetUsername?: string;
  details?: string;
  createdAt: any;
}

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  globalSoundEnabled: boolean;
  registrationEnabled: boolean;
}
