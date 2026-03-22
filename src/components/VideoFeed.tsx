import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { Loader2, Video as VideoIcon } from 'lucide-react';

interface VideoFeedProps {
  onProfileClick: (uid: string) => void;
  onCommentClick: (video: Video) => void;
}

export default function VideoFeed({ onProfileClick, onCommentClick }: VideoFeedProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const videosCol = collection(db, 'videos');
    const q = query(videosCol, orderBy('createdAt', 'desc'), limit(20));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      
      setVideos(videoList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full bg-black overflow-hidden">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-full w-full relative animate-pulse bg-zinc-900 border-b border-zinc-800">
            <div className="absolute bottom-20 left-4 space-y-3 w-2/3">
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-full" />
              <div className="h-3 bg-zinc-800 rounded w-3/4" />
            </div>
            <div className="absolute bottom-20 right-4 space-y-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full" />
              <div className="w-12 h-12 bg-zinc-800 rounded-full" />
              <div className="w-12 h-12 bg-zinc-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-zinc-500 p-8 text-center">
        <VideoIcon size={64} className="mb-4 opacity-20" />
        <h3 className="text-xl font-bold text-white mb-2">No videos yet</h3>
        <p>Be the first to upload a video to TokTok!</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar">
      {videos.map(video => (
        <VideoCard 
          key={video.id} 
          video={video} 
          onProfileClick={onProfileClick}
          onCommentClick={onCommentClick}
        />
      ))}
    </div>
  );
}
