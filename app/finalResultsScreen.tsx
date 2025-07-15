import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import socket from '../lib/socket';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHandler, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

type PlayerScore = {
    name: string;
    points: number;
};

type PlayerRoundScore = {
    player: string;
    [key: string]: number | string;
};

type RoundBreakdown = {
    round: number;
    scores: PlayerRoundScore[];
};

const categories = [
    { key: 'name', label: 'Name' },
    { key: 'surname', label: 'Surname' },
    { key: 'place', label: 'Place' },
    { key: 'animalBird', label: 'Animal/Bird' },
    { key: 'thing', label: 'Thing' },
    { key: 'movie', label: 'Movie' },
    { key: 'fruitFlower', label: 'Fruit/Flower' },
    { key: 'colorDish', label: 'Color/Dish' },
];

export default function FinalResultsScreen() {
    const { roomId, name } = useLocalSearchParams();
    const router = useRouter();

    const [winner, setWinner] = useState<PlayerScore | null>(null);
    const [scores, setScores] = useState<PlayerScore[]>([]);
    const [breakdown, setBreakdown] = useState<RoundBreakdown[]>([]);

    useEffect(() => {
        socket.on('gameOver', (data) => {
            setWinner(data.winner);
            setScores(data.scores || []);
            setBreakdown(data.breakdown || []);
        });

        // 🔁 Handle restart and navigate back to Input Screen
        socket.on('startRound', ({ round, letter }) => {
            router.replace({
                pathname: '/inputScreen',
                params: {
                    roomId,
                    name,
                    round: String(round),
                    letter,
                    isHost: 'false', // same role continues
                },
            });
        });

        socket.emit('getFinalResults', { roomId });

        return () => {
            socket.off('gameOver');
            socket.off('startRound');
        };
    }, []);

    const onPlayAgain = () => {
        socket.emit('restartGame', { roomId }); // 🔄 Restart logic
    };

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                Alert.alert(
                    'Leave Game?',
                    'Going back will exit the game. Are you sure?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Yes',
                            style: 'destructive',
                            onPress: () => router.back(),
                        },
                    ]
                );
                return true;
            };

            const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => backHandler.remove();
        }, [])
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <ScrollView className="p-4">
                {/* Header */}
                <View className="bg-yellow-100 border border-yellow-300 p-5 rounded-2xl mb-6 shadow">
                    <Text className="text-2xl font-bold text-center text-yellow-900">🏆 Game Over!</Text>
                    {winner && (
                        <Text className="text-center mt-2 text-lg font-semibold text-yellow-800">
                            Winner: {winner.name} – {winner.points} pts
                        </Text>
                    )}
                </View>

                {/* Final Scoreboard */}
                <View className="bg-white p-5 rounded-2xl shadow mb-6">
                    <Text className="text-xl font-bold text-center text-gray-800 mb-3">Final Scores</Text>
                    {scores.map((player, index) => {
                        const isYou = player.name === name;
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                        const bgColor = index === 0
                            ? 'bg-yellow-100'
                            : index === 1
                                ? 'bg-gray-200'
                                : index === 2
                                    ? 'bg-orange-100'
                                    : 'bg-white';
                        return (
                            <View
                                key={player.name}
                                className={`flex-row justify-between items-center p-3 mb-2 rounded-xl border ${bgColor}`}
                            >
                                <View className="flex-row items-center space-x-2">
                                    <Text className="text-lg font-bold text-gray-800 mr-4">#{index + 1}</Text>
                                    <Text className="text-lg">{player.name}</Text>
                                    {isYou && (
                                        <Text className="ml-2 px-2 py-0.5 bg-blue-100 text-xs rounded-full text-blue-700">
                                            You
                                        </Text>
                                    )}
                                </View>
                                <Text className="text-lg font-semibold text-blue-700">
                                    {player.points} pts {medal}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Round Breakdown */}
                <View className="bg-white p-5 rounded-2xl shadow mb-6">
                    <Text className="text-xl font-bold text-center text-gray-800 mb-3">Your Round Breakdown</Text>
                    {breakdown.length > 0 ? (
                        breakdown.map((r) => {
                            const playerScore = r.scores?.find(s => s.player === name);
                            if (!playerScore) return null;

                            return (
                                <View
                                    key={`round-${r.round}`}
                                    className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200 shadow-sm"
                                >
                                    <Text className="text-base font-semibold text-gray-800 mb-2">Round {r.round}</Text>
                                    {categories.map(({ key, label }) => (
                                        <Text key={key} className="text-sm text-gray-700">
                                            {label}: +{playerScore[key] ?? 0}
                                        </Text>
                                    ))}
                                    <Text className="text-sm font-bold text-blue-700 mt-2">
                                        Total: {playerScore.total}
                                    </Text>
                                </View>
                            );
                        })
                    ) : (
                        <Text className="text-center text-gray-500 italic">No breakdown available</Text>
                    )}
                </View>

                <TouchableOpacity
                    onPress={onPlayAgain}
                    className="bg-blue-600 py-3 rounded-2xl mt-4 mb-10 shadow"
                >
                    <Text className="text-center text-white font-semibold text-lg">🏠 Play Again</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
