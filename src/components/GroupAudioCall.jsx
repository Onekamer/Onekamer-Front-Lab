import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, createLocalTracks } from 'livekit-client';
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';

const GroupAudioCall = ({ url, token, roomName, onLeave }) => {
  const roomRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [error, setError] = useState(null);
  const remoteAudioElementsRef = useRef(new Map());

  useEffect(() => {
    let isCancelled = false;

    const setupRoom = async () => {
      try {
        setIsConnecting(true);
        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, () => {
          setParticipantsCount((c) => c + 1);
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          setParticipantsCount((c) => Math.max(1, c - 1));
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind !== Track.Kind.Audio) return;
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          track.attach(audioEl);
          remoteAudioElementsRef.current.set(track.sid, audioEl);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const audioEl = remoteAudioElementsRef.current.get(track.sid);
          if (audioEl) {
            track.detach(audioEl);
            audioEl.remove();
            remoteAudioElementsRef.current.delete(track.sid);
          }
        });

        await room.connect(url, token);
        if (isCancelled) return;

        const localTracks = await createLocalTracks({ audio: true, video: false });
        if (isCancelled) {
          localTracks.forEach((t) => t.stop());
          return;
        }
        const audioTrack = localTracks.find((t) => t.kind === Track.Kind.Audio);
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack);
          localAudioTrackRef.current = audioTrack;
        }

        setIsConnected(true);
        setIsConnecting(false);
      } catch (e) {
        console.error('Erreur connexion LiveKit:', e);
        if (!isCancelled) {
          setError(e?.message || "Impossible de rejoindre l'appel.");
          setIsConnecting(false);
        }
      }
    };

    setupRoom();

    return () => {
      isCancelled = true;
      const room = roomRef.current;
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current = null;
      }
      remoteAudioElementsRef.current.forEach((audioEl, sid) => {
        audioEl.remove();
        remoteAudioElementsRef.current.delete(sid);
      });
    };
  }, [url, token]);

  const handleToggleMute = async () => {
    const track = localAudioTrackRef.current;
    if (!track) return;
    try {
      if (isMuted) {
        await track.unmute();
        setIsMuted(false);
      } else {
        await track.mute();
        setIsMuted(true);
      }
    } catch (e) {
      console.error('Erreur mute/unmute:', e);
    }
  };

  const handleLeave = () => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }
    remoteAudioElementsRef.current.forEach((audioEl, sid) => {
      audioEl.remove();
      remoteAudioElementsRef.current.delete(sid);
    });
    if (onLeave) onLeave();
  };

  return (
    <div className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-white/90 border rounded-lg shadow-sm mb-2">
      <div className="flex flex-col text-xs">
        <span className="font-semibold text-gray-800">Appel audio en cours</span>
        {roomName && (
          <span className="text-[11px] text-gray-500 truncate max-w-[180px]">Salle : {roomName}</span>
        )}
        <span className="text-[11px] text-gray-500">
          {isConnecting
            ? 'Connexion en cours...'
            : error
            ? error
            : `${participantsCount} participant${participantsCount > 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleMute}
          disabled={!isConnected || !!error}
          className={`flex items-center justify-center h-8 w-8 rounded-full border text-white ${
            isMuted ? 'bg-gray-500 border-gray-500' : 'bg-[#2BA84A] border-[#2BA84A]'
          }`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center justify-center h-8 w-8 rounded-full border border-red-500 bg-red-500 text-white"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

export default GroupAudioCall;
