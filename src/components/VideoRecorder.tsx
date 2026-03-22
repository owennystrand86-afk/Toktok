import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Check, RotateCcw, Video as VideoIcon, StopCircle, Shield, Volume2, VolumeX, Loader2 } from 'lucide-react';

interface VideoRecorderProps {
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ onComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isInitializing, setIsInitializing] = useState(true);

  const stopCamera = () => {
    console.log("Stopping camera tracks...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
      streamRef.current = null;
    }
    setStream(null);
  };

  useEffect(() => {
    console.log("VideoRecorder mounted");
    startCamera();
    return () => {
      console.log("VideoRecorder unmounting, cleaning up...");
      stopCamera();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream && !recordedBlob) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, recordedBlob]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [recordedBlob]);

  const startCamera = async () => {
    console.log("Starting camera...");
    setIsInitializing(true);
    if (streamRef.current) {
      console.log("Already have stream ref");
      setIsInitializing(false);
      return;
    }
    setPermissionError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Re-enable for better volume consistency
          channelCount: 1
        } 
      });
      console.log("Stream obtained:", s.id);
      setStream(s);
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setIsInitializing(false);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsInitializing(false);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionError("Camera permission denied. Please grant permission in your browser settings and refresh the page.");
      } else {
        setPermissionError("Could not access camera. Please ensure your camera is connected and not in use by another app.");
      }
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const startRecording = () => {
    if (!streamRef.current) {
      console.error("No stream available for recording");
      return;
    }
    chunksRef.current = [];
    setRecordedBlob(null);
    setIsProcessing(false);
    
    const types = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    console.log("Supported mimeTypes check:", types.map(t => ({ type: t, supported: MediaRecorder.isTypeSupported(t) })));
    console.log("Using mimeType for recording:", mimeType);
      
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 5000000 // Increased to 5 Mbps for high quality
    });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    recorder.onstop = () => {
      console.log("MediaRecorder stopped, total chunks:", chunksRef.current.length);
      if (chunksRef.current.length === 0) {
        console.error("No data chunks captured!");
        setIsProcessing(false);
        setIsRecording(false);
        return;
      }
      setIsProcessing(true);
      
      // Use a minimal delay to ensure all chunks are processed
      setTimeout(() => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log("Blob created successfully, size:", blob.size);
          if (blob.size === 0) {
            throw new Error("Created blob is empty");
          }
          setRecordedBlob(blob);
          chunksRef.current = []; 
        } catch (err) {
          console.error("Error creating blob:", err);
          setPermissionError("Failed to process recording. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      }, 300);
    };
    recorder.onerror = (e: any) => {
      console.error("MediaRecorder error:", e?.error?.message || e?.message || "Unknown recorder error");
      setIsRecording(false);
      setIsProcessing(false);
    };
    
    // Start with a larger timeslice to reduce event overhead and speed up processing
    recorder.start(2000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDone = () => {
    console.log("Video recording complete, sending blob to parent");
    if (recordedBlob) {
      onComplete(recordedBlob);
    }
  };

  const handleRetry = () => {
    console.log("Retrying recording, clearing blob...");
    setRecordedBlob(null);
    startCamera();
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const handlePreviewError = () => {
    const error = videoRef.current?.error;
    let message = "Unknown preview error";
    if (error) {
      switch (error.code) {
        case 1: message = "Preview playback aborted"; break;
        case 2: message = "Network error while loading preview"; break;
        case 3: message = "Preview decoding failed"; break;
        case 4: message = "Preview format not supported"; break;
        default: message = `Preview error: ${error.message || 'Unknown code ' + error.code}`;
      }
    }
    console.error("Preview video error:", message, previewUrl);
    setPermissionError(message); // Reuse permissionError for display or add a new state
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[110] flex flex-col"
    >
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button onClick={handleCancel} className="p-2 bg-black/40 rounded-full text-white">
          <X size={24} />
        </button>
        {recordedBlob && (
          <button 
            onClick={() => setIsPreviewMuted(!isPreviewMuted)} 
            className="p-2 bg-black/40 rounded-full text-white"
          >
            {isPreviewMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        )}
      </div>

      <div className="flex-1 relative bg-zinc-900 flex items-center justify-center">
        {isInitializing && !stream && !permissionError && (
          <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center gap-4">
            <Loader2 size={48} className="text-red-500 animate-spin" />
            <span className="text-white font-bold">Initializing Camera...</span>
          </div>
        )}
        {isRecording && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">Recording</span>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 z-30 bg-black/60 flex flex-col items-center justify-center gap-4">
            <Loader2 size={48} className="text-red-500 animate-spin" />
            <span className="text-white font-bold">Processing Video...</span>
          </div>
        )}
        {previewUrl ? (
          <video 
            src={previewUrl} 
            className="h-full w-full object-cover" 
            controls 
            autoPlay 
            loop 
            muted={isPreviewMuted}
            playsInline
            onError={handlePreviewError}
          />
        ) : (
          <video 
            ref={videoRef} 
            className="h-full w-full object-cover" 
            autoPlay 
            muted 
            playsInline 
          />
        )}

        {permissionError && (
          <div className="absolute inset-0 z-[250] bg-black/90 flex flex-col items-center justify-center p-8 text-center gap-6">
            <div className="p-6 bg-red-500/20 rounded-full">
              <Shield size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold">Camera Access Required</h2>
            <p className="text-zinc-400 text-sm max-w-xs">{permissionError}</p>
            <button 
              onClick={startCamera}
              className="bg-red-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
            <button 
              onClick={handleCancel}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="p-8 bg-black flex items-center justify-around">
        {!recordedBlob ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
              isRecording ? 'border-red-500 bg-red-500/20' : 'border-white bg-white/10'
            }`}
          >
            {isRecording ? (
              <StopCircle size={48} className="text-red-500" />
            ) : (
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            )}
          </button>
        ) : (
          <div className="flex gap-12">
            <button
              onClick={handleRetry}
              className="flex flex-col items-center gap-2 text-white"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <RotateCcw size={32} />
              </div>
              <span className="text-xs font-bold">Retry</span>
            </button>
            <button
              onClick={handleDone}
              className="flex flex-col items-center gap-2 text-white"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                <Check size={32} />
              </div>
              <span className="text-xs font-bold">Post</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
