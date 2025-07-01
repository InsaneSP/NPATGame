import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import socket from '../lib/socket';

export default function HomeScreen() {
    const [name, setName] = useState('');
    const router = useRouter();

    const handleJoin = () => {
        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name to join the game.');
            return;
        }

        socket.emit('registerPlayer', { name });

        router.push({
            pathname: '/join',
            params: { name, isHost: 'false' },
        });
    };

    return (
        <View className="flex-1 bg-gray-100 p-6 justify-center">
            {/* Game Title */}
            <View className="items-center mb-8">
                <Text className="text-3xl font-bold text-blue-700">Name, Place, Animal, Thing</Text>
                <Text className="text-lg text-gray-600 mt-1">Multiplayer Word Game</Text>
            </View>

            {/* Name Input Card */}
            <View className="bg-white p-5 rounded-2xl shadow-md mb-8">
                <Text className="text-lg font-semibold text-gray-800 mb-2">Enter Your Name</Text>
                <TextInput
                    className="border border-gray-300 rounded-xl bg-gray-50 px-4 py-3 text-base"
                    placeholder="Your name"
                    value={name}
                    onChangeText={setName}
                />
                <TouchableOpacity
                    className="bg-blue-600 mt-4 py-3 rounded-xl"
                    onPress={handleJoin}
                >
                    <Text className="text-white text-center font-semibold text-lg">🎮 Join Game</Text>
                </TouchableOpacity>
            </View>

            {/* Info Section */}
            <View className="bg-white p-4 rounded-xl shadow-md">
                <Text className="text-center text-gray-700 font-medium mb-2">What makes it fun?</Text>
                <View className="space-y-1">
                    <Text className="text-base text-gray-700">✅ Play live with friends</Text>
                    <Text className="text-base text-gray-700">🏆 Score based on unique answers</Text>
                    <Text className="text-base text-gray-700">👑 Room creator moderates scoring</Text>
                </View>
            </View>
        </View>
    );
}
