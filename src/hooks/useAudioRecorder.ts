import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

interface UseAudioRecorderReturn {
    recording: Audio.Recording | null;
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>; // Returns URI
    permissionResponse: Audio.PermissionResponse | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        // Configure audio mode for iOS/Android
        Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });
    }, []);

    const startRecording = useCallback(async () => {
        try {
            if (permissionResponse?.status !== 'granted') {
                const permission = await requestPermission();
                if (permission.status !== 'granted') {
                    Alert.alert('권한 필요', '음성 메모를 위해 마이크 권한이 필요합니다.');
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('오류', '녹음을 시작할 수 없습니다.');
        }
    }, [permissionResponse, requestPermission]);

    const stopRecording = useCallback(async () => {
        if (!recording) return null;

        try {
            console.log('Stopping recording..');
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped and stored at', uri);

            setRecording(null);
            setIsRecording(false);

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            return uri;
        } catch (err) {
            console.error('Failed to stop recording', err);
            Alert.alert('오류', '녹음을 저장하는 중 문제가 발생했습니다.');
            return null;
        }
    }, [recording]);

    return {
        recording,
        isRecording,
        startRecording,
        stopRecording,
        permissionResponse,
    };
}
