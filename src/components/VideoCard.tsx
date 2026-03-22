import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music, User as UserIcon, Shield, CheckCircle, Volume2, VolumeX, Gauge, Play, Pause, Video as VideoIcon, Loader2, Repeat, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Video } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { soundManager, cn } from '../utils';

import { useXP } from '../hooks/useXP';

interface VideoCardProps {
  video: Video;
  onProfileClick: (uid: string) => void;
  onCommentClick: (video: Video) => void;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onProfileClick, onCommentClick }) => {
  const { addXP } = useXP();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likesCount);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted for better auto-play reliability
  const [isLooping, setIsLooping] = useState(true); // Default to looping for TikTok-like feel
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [lastTap, setLastTap] = useState(0);
  const [showDoubleTapHint, setShowDoubleTapHint] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { ref, inView } = useInView({
    threshold: 0.6,
  });

  useEffect(() => {
    if (inView) {
      videoRef.current?.play().catch(() => {});
      setIsPlaying(true);
      
      // Show double tap hint briefly when video starts
      setShowDoubleTapHint(true);
      const timer = setTimeout(() => setShowDoubleTapHint(false), 3000);
      return () => clearTimeout(timer);
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
      setShowDoubleTapHint(false);
    }
  }, [inView]);

  useEffect(() => {
    if (!auth.currentUser || video.id.startsWith('initial_')) return;
    const likeRef = doc(db, `videos/${video.id}/likes`, auth.currentUser.uid);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, `videos/${video.id}/likes`));
    return () => unsubscribe();
  }, [video.id]);

  useEffect(() => {
    if (video.id.startsWith('initial_')) return;
    const videoDocRef = doc(db, 'videos', video.id);
    const unsubscribe = onSnapshot(videoDocRef, (doc) => {
      if (doc.exists()) {
        setLikesCount(doc.data().likesCount || 0);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `videos/${video.id}`));
    return () => unsubscribe();
  }, [video.id]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const newHeart: FloatingHeart = {
        id: now,
        x: clientX,
        y: clientY,
        rotation: Math.random() * 40 - 20,
        scale: Math.random() * 0.5 + 0.8
      };
      
      setFloatingHearts(prev => [...prev, newHeart]);
      soundManager.play('like');
      
      if (!isLiked) {
        toggleLike(e as any);
      }
      
      // Remove heart after animation
      setTimeout(() => {
        setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
      }, 1000);
    } else {
      togglePlay();
    }
    setLastTap(now);
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.play('pop');
    if (!auth.currentUser) {
      alert("Please sign in to like videos!");
      return;
    }

    if (video.id.startsWith('initial_')) {
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
      return;
    }

    const likeRef = doc(db, `videos/${video.id}/likes`, auth.currentUser.uid);
    const videoRef = doc(db, 'videos', video.id);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(videoRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, {
          videoId: video.id,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
        await updateDoc(videoRef, { likesCount: increment(1) });
        // Reward XP for liking
        addXP(10);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `videos/${video.id}/likes`);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch((err) => {
          console.error("Playback failed:", err);
          // If playback fails, it might be due to autoplay restrictions, try muting
          if (err.name === 'NotAllowedError') {
            setIsMuted(true);
            videoRef.current!.muted = true;
            videoRef.current!.play().catch(e => console.error("Muted playback also failed:", e));
          }
        });
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleVideoError = () => {
    const error = videoRef.current?.error;
    let message = "Unknown video error";
    
    if (error) {
      switch (error.code) {
        case 1: message = "Video playback aborted"; break;
        case 2: message = "Network error while loading video"; break;
        case 3: message = "Video decoding failed (corrupt file?)"; break;
        case 4: message = "Video format not supported by your browser"; break;
        default: message = `Video error: ${error.message || 'Unknown code ' + error.code}`;
      }
    }

    console.error("Video playback error:", message, {
      url: video.videoUrl.startsWith('data:') ? `data URL (length: ${video.videoUrl.length})` : video.videoUrl,
      errorObj: error,
      networkState: videoRef.current?.networkState,
      readyState: videoRef.current?.readyState
    });
    setErrorMessage(message);
    setHasError(true);
    setIsLoading(false);
  };

  const handleWaiting = () => setIsLoading(true);
  const handlePlaying = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      setIsMuted(v === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.volume = newMuted ? 0 : volume;
      videoRef.current.muted = newMuted;
    }
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isImage = video.videoUrl.startsWith('data:image/') || video.videoUrl.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i);

  return (
    <div 
      ref={ref} 
      className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
    >
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-8 text-center gap-4">
          <div className="p-4 bg-zinc-800 rounded-full">
            <VideoIcon size={48} className="opacity-20" />
          </div>
          <p className="text-sm font-medium">{errorMessage || "Video unavailable or format not supported"}</p>
          <button 
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="text-xs text-red-500 font-bold hover:underline"
          >
            Try Reloading
          </button>
        </div>
      ) : isImage ? (
        <img 
          src={video.videoUrl} 
          alt={video.description} 
          className="h-full w-full object-contain"
          referrerPolicy="no-referrer"
        />
      ) : !video.videoUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-8 text-center gap-4">
          <div className="p-4 bg-zinc-800 rounded-full">
            <VideoIcon size={48} className="opacity-20" />
          </div>
          <p className="text-sm font-medium">Invalid video source</p>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <Loader2 className="animate-spin text-red-500" size={48} />
            </div>
          )}
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="h-full w-full object-cover cursor-pointer"
            loop={isLooping}
            playsInline
            preload="auto"
            muted={isMuted}
            onClick={handleDoubleTap}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleVideoError}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
          />
          
          {/* Floating Hearts Container */}
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            <AnimatePresence>
              {floatingHearts.map(heart => (
                <motion.div
                  key={heart.id}
                  initial={{ opacity: 0, scale: 0, x: heart.x - 50, y: heart.y - 50, rotate: heart.rotation }}
                  animate={{ 
                    opacity: [0, 1, 1, 0], 
                    scale: [0, heart.scale, heart.scale * 1.2, 0],
                    y: heart.y - 250,
                    x: heart.x - 50 + (Math.random() * 100 - 50)
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                >
                  <Heart size={100} fill="currentColor" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Double Tap Hint */}
      <AnimatePresence>
        {showDoubleTapHint && !isLiked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
          >
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              <span className="text-xs font-bold text-white whitespace-nowrap">Double tap to like</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
        <div className="flex justify-between items-end w-full pointer-events-auto">
          {/* Info Section */}
          <div className="flex-1 text-white max-w-[80%]">
            <button 
              onClick={() => onProfileClick(video.creatorId)}
              className="font-bold text-lg mb-2 hover:underline flex items-center gap-1"
            >
              @{video.creatorUsername}
              {video.isAdminCreator && <Shield size={14} className="text-blue-400 fill-blue-400" />}
              {video.isVerifiedCreator && <CheckCircle size={14} className="text-cyan-400 fill-cyan-400" />}
            </button>
            <p className="text-sm mb-3 line-clamp-2">{video.description}</p>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Music size={14} className="animate-spin-slow" />
              <span className="truncate">Original Sound - {video.creatorUsername}</span>
            </div>

            {/* Playback Controls */}
            {!isImage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 10 }}
                className="mt-4 space-y-3 pointer-events-auto bg-black/40 p-3 rounded-xl backdrop-blur-md border border-white/10"
              >
                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono min-w-[30px]">{formatTime(currentTime)}</span>
                  <input 
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-500 hover:h-2 transition-all"
                  />
                  <span className="text-[10px] font-mono min-w-[30px]">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Play/Pause */}
                    <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors">
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    {/* Volume */}
                    <div className="flex items-center gap-2 group relative">
                      <button onClick={toggleMute} className="text-white hover:text-red-500 transition-colors">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-0 group-hover:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white transition-all overflow-hidden"
                      />
                    </div>

                    {/* Loop Toggle */}
                    <button 
                      onClick={toggleLoop} 
                      className={cn(
                        "transition-all p-1 rounded-md",
                        isLooping ? "text-red-500 bg-red-500/10" : "text-white hover:bg-white/10"
                      )}
                      title={isLooping ? "Looping On" : "Looping Off"}
                    >
                      <Repeat size={20} className={isLooping ? "animate-pulse" : ""} />
                    </button>
                  </div>

                  {/* Playback Speed */}
                  <div className="flex items-center gap-2">
                    <Gauge size={16} className="text-zinc-400" />
                    <div className="flex gap-1">
                      {[0.5, 1, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handlePlaybackRateChange(rate)}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded-md transition-all font-bold",
                            playbackRate === rate ? "bg-red-500 text-white" : "bg-white/10 text-zinc-400 hover:bg-white/20"
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-6 mb-4">
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => onProfileClick(video.creatorId)}
                className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-zinc-800 flex items-center justify-center relative"
              >
                {video.creatorPhotoURL ? (
                  <img src={video.creatorPhotoURL} alt={video.creatorUsername} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="text-white" />
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs font-bold">
                  +
                </div>
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={toggleLike}
                className={cn(
                  "w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all active:scale-90",
                  isLiked ? "text-red-500" : "text-white"
                )}
              >
                <Heart size={28} fill={isLiked ? "currentColor" : "none"} className={cn(isLiked && "animate-bounce-short")} />
              </button>
              <span className="text-white text-xs font-bold drop-shadow-md">{likesCount}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => {
                  soundManager.play('click');
                  onCommentClick(video);
                }}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all active:scale-90"
              >
                <MessageCircle size={28} />
              </button>
              <span className="text-white text-xs font-bold drop-shadow-md">{video.commentsCount}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => soundManager.play('click')}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all active:scale-90"
              >
                <Share2 size={28} />
              </button>
              <span className="text-white text-xs font-bold drop-shadow-md">{video.sharesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permanent Thin Progress Bar */}
      {!isImage && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 overflow-hidden z-20">
          <motion.div 
            className="h-full bg-red-500"
            style={{ width: `${(currentTime / duration) * 100}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
          />
        </div>
      )}

      {/* Play/Pause Indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-black/20 backdrop-blur-sm p-6 rounded-full">
              <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
