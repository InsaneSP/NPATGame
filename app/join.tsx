import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import socket from '../lib/socket';

export default function JoinRoomScreen() {
    const { name } = useLocalSearchParams();
    const [roomId, setRoomId] = useState('');
    const router = useRouter();

    const generateRoomId = () => {
        const newId = Math.random().toString(36).substr(2, 6).toUpperCase();
        setRoomId(newId);
        socket.emit('registerRoomCreator', { name, roomId: newId });
        router.push({ pathname: '/game', params: { name: name as string, roomId: newId, isHost: 'true' } });
    };

    const joinRoom = () => {
        if (!roomId) return;
        socket.emit('joinExistingRoom', { name, roomId });
        router.push({ pathname: '/game', params: { name: name as string, roomId, isHost: 'false' } });
    };

    return (
        <View className="flex-1 bg-gray-100 p-5 justify-center">
            {/* Card */}
            <View className="bg-white p-6 rounded-2xl shadow-md">
                {/* Header */}
                <View className="items-center mb-5">
                    <Text className="text-3xl font-bold text-blue-700">Join Room</Text>
                    <Text className="text-sm text-gray-600 mt-1">Play with your friends 🎮</Text>
                </View>

                {/* Player Name */}
                <View className="flex-row items-center justify-center space-x-2 mb-4">
                    <FontAwesome name="user" size={18} color="green" />
                    <Text className="text-base text-green-700 font-medium">Player: {name}</Text>
                </View>

                {/* Room ID Input */}
                <View className="mb-5">
                    <Text className="text-sm text-gray-700 font-medium mb-1">Room ID</Text>
                    <TextInput
                        className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-lg tracking-widest text-center"
                        placeholder="ABC123"
                        value={roomId}
                        onChangeText={setRoomId}
                        maxLength={6}
                        autoCapitalize="characters"
                    />
                </View>

                {/* Join Button */}
                <TouchableOpacity
                    className="bg-green-600 rounded-xl py-3 mb-4 shadow"
                    onPress={joinRoom}
                >
                    <Text className="text-white text-center text-lg font-semibold">Join Room</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View className="border-t border-gray-200 mb-4" />

                {/* Generate Room Button */}
                <TouchableOpacity
                    className="flex-row items-center justify-center bg-yellow-100 rounded-xl py-3 border border-yellow-300 shadow"
                    onPress={generateRoomId}
                >
                    <MaterialCommunityIcons name="dice-5" size={20} color="#92400e" />
                    <Text className="text-yellow-900 text-lg font-semibold ml-2">Generate New Room</Text>
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text className="text-center text-gray-500 mt-6 text-sm">
                Share the Room ID with your friends to start playing!
            </Text>
        </View>
    );
}
