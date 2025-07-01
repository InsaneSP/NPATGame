import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import socket from '../lib/socket';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GameScreen() {
    const { name, roomId, isHost } = useLocalSearchParams();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const isCurrentHost = isHost === 'true';

    useEffect(() => {
        socket.emit('joinRoom', { roomId, name, isHost: isCurrentHost });

        socket.on('roomUpdate', (room) => {
            setPlayers(room.players);
        });

        socket.on('gameStarted', () => {
            router.push({
                pathname: '/inputScreen',
                params: { name, roomId, isHost },
            });
        });

        return () => {
            socket.off('roomUpdate');
            socket.off('gameStarted');
        };
    }, []);

    const startGame = () => {
        socket.emit('startGame', { roomId });
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <ScrollView className="p-4">
                {/* Header */}
                <View className="bg-white p-5 rounded-2xl shadow mb-6">
                    <Text className="text-2xl font-bold text-blue-700 text-center mb-1">
                        Room Code: {roomId}
                    </Text>
                    <Text className="text-base text-gray-600 text-center">
                        Waiting for players to join...
                    </Text>
                </View>

                {/* Players List */}
                <View className="bg-white p-4 rounded-2xl shadow mb-6">
                    <Text className="text-xl font-semibold text-gray-800 mb-4 text-center">
                        Players ({players.length})
                    </Text>
                    {players.map((player, idx) => {
                        const isCurrentUser = player.name === name;
                        const isCreator = player.isHost;
                        let bgColor = 'bg-gray-50';

                        if (isCurrentUser && isCreator) bgColor = 'bg-yellow-100';
                        else if (isCurrentUser) bgColor = 'bg-green-100';
                        else if (isCreator) bgColor = 'bg-yellow-50';

                        return (
                            <View
                                key={`${player.name}-${player.id}-${idx}`}
                                className={`mb-3 p-4 rounded-xl border border-gray-200 ${bgColor}`}
                            >
                                <View className="flex-row justify-between items-center">
                                    <Text className="text-lg font-medium text-gray-900">{player.name}</Text>
                                    <View className="flex-row space-x-2">
                                        {isCreator && (
                                            <Text className="text-sm bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-full">
                                                👑 Host
                                            </Text>
                                        )}
                                        {isCurrentUser && (
                                            <Text className="text-sm bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                                                You
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Start Game Button (Host Only) */}
                {isCurrentHost && players.length > 1 && (
                    <TouchableOpacity
                        className="bg-blue-600 py-4 rounded-xl shadow"
                        onPress={startGame}
                    >
                        <Text className="text-white text-center font-bold text-lg">🚀 Start Game</Text>
                    </TouchableOpacity>
                )}

                {!isCurrentHost && (
                    <Text className="text-center text-gray-500 text-sm mt-4">
                        Waiting for host to start the game...
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
