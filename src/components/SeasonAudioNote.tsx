import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Colors, Spacing } from '../constants/theme';
import { Button } from './Button';

/**
 * Spoken answer to "What would you do differently?".
 * The recording stays on the phone and is uploaded to the private `season-audio` bucket when
 * there is a connection, so it is never lost for lack of signal.
 */
interface StoredNote {
  uri: string;
  path: string;
  uploaded: boolean;
}

interface Props {
  seasonId: string;
  /** Storage path already saved on the season record (set once the upload succeeded). */
  uploadedPath?: string | null;
  offline: boolean;
  onUploaded: (path: string) => void;
}

const storageKey = (seasonId: string) => `@agritrack_season_audio_${seasonId}`;

export const SeasonAudioNote: React.FC<Props> = ({ seasonId, uploadedPath, offline, onUploaded }) => {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY); // small files for weak connections
  const [note, setNote] = useState<StoredNote | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const player = useAudioPlayer(note ? { uri: note.uri } : null);

  useEffect(() => {
    AsyncStorage.getItem(storageKey(seasonId))
      .then((raw) => setNote(raw ? (JSON.parse(raw) as StoredNote) : null))
      .catch(() => setNote(null));
  }, [seasonId]);

  const upload = useCallback(
    async (target: StoredNote) => {
      if (target.uploaded || offline || !isSupabaseConfigured()) return;
      setUploading(true);
      try {
        const body = await (await fetch(target.uri)).arrayBuffer();
        const { error } = await supabase.storage
          .from('season-audio')
          .upload(target.path, body, { contentType: 'audio/mp4', upsert: true });
        if (error) throw error;
        const done = { ...target, uploaded: true };
        await AsyncStorage.setItem(storageKey(seasonId), JSON.stringify(done));
        setNote(done);
        onUploaded(target.path);
      } catch (e) {
        console.warn('Audio note will upload later:', (e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [offline, onUploaded, seasonId]
  );

  // Retry a recording that could not be uploaded earlier.
  useEffect(() => {
    if (note && !note.uploaded && !offline) upload(note);
  }, [note, offline, upload]);

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow the microphone to record your answer.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert('Could not record', (e as Error).message);
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) return;
      const saved: StoredNote = { uri: recorder.uri, path: `${seasonId}/${Date.now()}.m4a`, uploaded: false };
      await AsyncStorage.setItem(storageKey(seasonId), JSON.stringify(saved));
      setNote(saved);
    } catch (e) {
      setRecording(false);
      Alert.alert('Could not save the recording', (e as Error).message);
    }
  };

  const hasRecording = Boolean(note) || Boolean(uploadedPath);
  const status = recording
    ? 'Recording... tap Stop when you finish.'
    : uploading
    ? 'Saving your recording...'
    : note && !note.uploaded
    ? 'Recorded on this phone. It will be saved online when you have a connection.'
    : hasRecording
    ? 'Your recording is saved.'
    : 'Tap Record and say it in your own words.';

  return (
    <View style={styles.wrap}>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.row}>
        {recording ? (
          <Button title="Stop" variant="danger" size="sm" onPress={stop} style={styles.button} />
        ) : (
          <Button
            title={hasRecording ? 'Record again' : 'Record'}
            variant="outline"
            size="sm"
            onPress={start}
            style={styles.button}
          />
        )}
        {note && !recording ? (
          <Button
            title="Play"
            variant="primary"
            size="sm"
            onPress={() => {
              player.seekTo(0);
              player.play();
            }}
            style={styles.button}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md },
  status: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  button: { minWidth: 110 },
});
