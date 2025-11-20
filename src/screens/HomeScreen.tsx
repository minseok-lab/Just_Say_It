import React from 'react';
import { View, Text, TouchableOpacity, FlatList, SafeAreaView, Alert } from 'react-native';
import { Mic, Settings, Calendar, CheckSquare, Lightbulb, FileText, Square } from 'lucide-react-native';
import { cn } from '../utils/cn';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { supabase } from '../services/supabase';
import { uploadAudio } from '../services/storage';

// Mock Data for UI Development
const MOCK_MEMOS = [
    { id: '1', summary: '내일 3시 치과 예약', type: 'SCHEDULE', date: '2025-05-21 15:00' },
    { id: '2', summary: '프로젝트 기획안 작성', type: 'TODO', date: null },
    { id: '3', summary: '새로운 앱 아이디어: 말만 해', type: 'IDEA', date: null },
    { id: '4', summary: '오늘 점심은 뭐 먹지?', type: 'NOTE', date: null },
];

const MemoCard = ({ item }: { item: any }) => {
    const getIcon = () => {
        switch (item.primary_type) {
            case 'SCHEDULE': return <Calendar size={20} color="#3B82F6" />;
            case 'TODO': return <CheckSquare size={20} color="#EF4444" />;
            case 'IDEA': return <Lightbulb size={20} color="#F59E0B" />;
            default: return <FileText size={20} color="#6B7280" />;
        }
    };

    return (
        <View className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row items-center space-x-3">
            <View className="p-2 bg-gray-50 rounded-full">
                {getIcon()}
            </View>
            <View className="flex-1">
                <Text className="text-gray-900 font-semibold text-base">{item.summary}</Text>
                {item.entities?.target_date && (
                    <Text className="text-gray-500 text-xs mt-1">
                        {new Date(item.entities.target_date).toLocaleString()}
                    </Text>
                )}
            </View>
        </View>
    );
};

export default function HomeScreen() {
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const [memos, setMemos] = React.useState<any[]>(MOCK_MEMOS);

    React.useEffect(() => {
        // Fetch initial memos
        const fetchMemos = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('memos')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) setMemos(data);
            }
        };

        fetchMemos();

        // Subscribe to realtime updates
        const subscription = supabase
            .channel('memos_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'memos' },
                (payload) => {
                    console.log('New memo received!', payload);
                    setMemos((prev) => [payload.new, ...prev]);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleMicPress = async () => {
        if (isRecording) {
            const uri = await stopRecording();
            if (uri) {
                try {
                    Alert.alert('업로드 중', '음성을 분석하고 있습니다...');

                    // 1. Get User ID
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        Alert.alert('오류', '로그인이 필요합니다.');
                        return;
                    }

                    // 2. Upload Audio
                    const path = await uploadAudio(uri, user.id);

                    // 3. Trigger Edge Function
                    const { data, error } = await supabase.functions.invoke('analyze-memo', {
                        body: { audio_url: path, user_id: user.id },
                    });

                    if (error) throw error;

                    Alert.alert('완료', '메모가 성공적으로 저장되었습니다.');
                } catch (error) {
                    console.error(error);
                    Alert.alert('오류', '메모 저장 중 문제가 발생했습니다.');
                }
            }
        } else {
            await startRecording();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Just Say It</Text>
                    <Text className="text-gray-500 text-sm">오늘의 생각, 말만 하세요.</Text>
                </View>
                <TouchableOpacity className="p-2 bg-gray-100 rounded-full">
                    <Settings size={24} color="#374151" />
                </TouchableOpacity>
            </View>

            {/* Memo List */}
            <FlatList
                data={memos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <MemoCard item={item} />}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20">
                        <Text className="text-gray-400 text-lg">아직 기록된 메모가 없어요.</Text>
                    </View>
                }
            />

            {/* Floating Action Button (Mic) */}
            <View className="absolute bottom-8 left-0 right-0 items-center">
                <TouchableOpacity
                    className={cn(
                        "w-16 h-16 rounded-full items-center justify-center shadow-lg",
                        isRecording ? "bg-red-500 shadow-red-500/50" : "bg-blue-600 shadow-blue-500/50"
                    )}
                    activeOpacity={0.8}
                    onPress={handleMicPress}
                >
                    {isRecording ? (
                        <Square size={24} color="white" fill="white" />
                    ) : (
                        <Mic size={32} color="white" />
                    )}
                </TouchableOpacity>
                {isRecording && (
                    <Text className="text-red-500 font-medium mt-2 animate-pulse">녹음 중...</Text>
                )}
            </View>
        </SafeAreaView>
    );
}
