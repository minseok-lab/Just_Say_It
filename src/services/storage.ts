import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

export const uploadAudio = async (uri: string, userId: string) => {
    try {
        const fileExt = uri.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const { data, error } = await supabase.storage
            .from('audio-memos')
            .upload(filePath, decode(base64), {
                contentType: 'audio/m4a',
            });

        if (error) {
            throw error;
        }

        return data.path;
    } catch (error) {
        console.error('Error uploading audio:', error);
        throw error;
    }
};
