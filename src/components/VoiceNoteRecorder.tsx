import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

interface VoiceNoteResult {
  uri: string;
  durationSeconds: number;
  label: string;
}

interface Props {
  onRecorded: (result: VoiceNoteResult) => void;
  onRemove?: () => void;
  currentAudioUri?: string | null;
  label?: string;
}

export const VoiceNoteRecorder: React.FC<Props> = ({
  onRecorded,
  onRemove,
  currentAudioUri,
  label = 'Voice Note',
}) => {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(currentAudioUri || null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio player hook and status subscription
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);

  // Sync external prop changes (e.g. form reset or preloaded note)
  useEffect(() => {
    if (currentAudioUri !== undefined) {
      setAudioUri(currentAudioUri || null);
    }
  }, [currentAudioUri]);

  // When audioUri updates, replace player source so it is ready for immediate playback
  useEffect(() => {
    if (audioUri && player) {
      try {
        player.replace({ uri: audioUri });
      } catch (err) {
        console.warn('Error syncing player source:', err);
      }
    }
  }, [audioUri, player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        if (player && player.playing) {
          player.pause();
        }
      } catch (_) {}
    };
  }, [player]);

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Needed',
          'Please allow microphone access to record voice field notes.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Voice recording error:', err);
      Alert.alert('Recording Error', err?.message || 'Could not start voice recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await recorder.stop();
      setIsRecording(false);

      // Re-enable playback mode immediately with silent mode support
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      const uri = recorder.uri;
      if (uri) {
        setAudioUri(uri);
        if (player) {
          try {
            player.replace({ uri });
          } catch (_) {}
        }
        const finalSecs = Math.max(seconds, 1);
        const noteLabel = `🎤 Voice note (${finalSecs}s)`;
        onRecorded({
          uri,
          durationSeconds: finalSecs,
          label: noteLabel,
        });
      }
    } catch (err: any) {
      setIsRecording(false);
      console.warn('Stop recording error:', err);
      Alert.alert('Recording Error', err?.message || 'Could not save voice recording.');
    }
  };

  const handleTogglePlay = async () => {
    if (!audioUri) return;
    try {
      // Ensure audio playback is permitted even when device is on silent/vibrate
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (status?.playing) {
        player.pause();
        return;
      }

      // If playback previously finished or reached end, seek back to beginning
      if (
        status?.didJustFinish ||
        (status?.duration > 0 && status?.currentTime >= status.duration - 0.2)
      ) {
        await player.seekTo(0);
      }

      // Ensure source is loaded if not already
      if (!player.isLoaded && audioUri) {
        player.replace({ uri: audioUri });
      }

      player.play();
    } catch (err: any) {
      console.warn('Playback error, retrying with source replacement:', err);
      try {
        if (player && audioUri) {
          player.replace({ uri: audioUri });
          player.play();
        }
      } catch (e2: any) {
        Alert.alert('Playback Notice', 'Could not play voice recording.');
      }
    }
  };

  const removeRecording = () => {
    try {
      if (status?.playing) {
        player.pause();
      }
    } catch (_) {}
    setAudioUri(null);
    setSeconds(0);
    if (onRemove) onRemove();
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.container}>
      {/* Recording in progress */}
      {isRecording ? (
        <View style={styles.recordingRow}>
          <View style={styles.pulsingBadge}>
            <View style={styles.redDot} />
            <Text style={styles.recordingTimer}>{formatTimer(seconds)}</Text>
          </View>
          <Text style={styles.recordingStatus}>Recording your field note...</Text>
          <TouchableOpacity
            style={styles.stopBtn}
            activeOpacity={0.8}
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={16} color="#FFFFFF" />
            <Text style={styles.stopBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : audioUri ? (
        /* Recording completed */
        <View style={styles.playerRow}>
          <TouchableOpacity
            style={[styles.playBtn, status?.playing && styles.playingBtn]}
            activeOpacity={0.8}
            onPress={handleTogglePlay}
          >
            <Ionicons
              name={status?.playing ? 'pause' : 'play'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.playBtnText}>
              {status?.playing ? 'Pause' : 'Play note'}
            </Text>
          </TouchableOpacity>

          <View style={styles.badgeWrap}>
            <Ionicons
              name={status?.playing ? 'volume-high' : 'mic'}
              size={13}
              color={status?.playing ? '#1B7F36' : Colors.primary}
            />
            <Text style={styles.badgeText}>
              {status?.playing
                ? `Playing (${formatTimer(Math.floor(status.currentTime || 0))})`
                : seconds > 0
                ? `Voice note (${formatTimer(seconds)})`
                : 'Voice recorded'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            activeOpacity={0.7}
            onPress={removeRecording}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      ) : (
        /* Idle state */
        <TouchableOpacity
          style={styles.micTriggerBtn}
          activeOpacity={0.8}
          onPress={startRecording}
        >
          <View style={styles.micIconCircle}>
            <Ionicons name="mic" size={15} color={Colors.primary} />
          </View>
          <Text style={styles.micTriggerText}>Tap to speak notes with voice</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  micTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F8F1',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#C9DBC4',
    alignSelf: 'flex-start',
    gap: 8,
  },
  micIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DDF0D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micTriggerText: {
    fontSize: 13,
    fontFamily: Typography.body,
    fontWeight: '600',
    color: '#1B7F36',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBE5DF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#F5C2B8',
  },
  pulsingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A3321F',
  },
  recordingTimer: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Typography.body,
    color: '#A3321F',
  },
  recordingStatus: {
    fontSize: 12,
    fontFamily: Typography.body,
    color: '#17301F',
    flex: 1,
    marginLeft: 8,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A3321F',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    gap: 4,
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.body,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F4DF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#C9DBC4',
    gap: 10,
    alignSelf: 'flex-start',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B7F36',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    gap: 4,
  },
  playingBtn: {
    backgroundColor: '#135C27',
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.body,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Typography.body,
    color: '#17301F',
  },
  deleteBtn: {
    padding: 4,
  },
});
