import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import socket from '../lib/socket';
import { SafeAreaView } from 'react-native-safe-area-context';

type CategoryScore = { player: string; answer: string; points: number };
type RoundResult = Record<string, CategoryScore[]>;
type PlayerSummary = {
    player: string;
    total: number;
    breakdown: Record<string, number>;
};

export default function ResultsScreen() {
    const { roomId, name, round, isHost } = useLocalSearchParams<{
        roomId: string;
        name: string;
        round: string;
        isHost: string;
    }>();

    const roundNumber = parseInt(round, 10);
    const router = useRouter();

    const [results, setResults] = useState<RoundResult>({});
    const [summary, setSummary] = useState<PlayerSummary[]>([]);
    const [nextLetter, setNextLetter] = useState('');
    const [hostReady, setHostReady] = useState(false);
    const [isCurrentHost, setIsCurrentHost] = useState(isHost === 'true');

    const displayName: Record<string, string> = {
        name: 'Name',
        surname: 'Surname',
        place: 'Place',
        animalBird: 'Animal/Bird',
        thing: 'Thing',
        movie: 'Movie',
        fruitFlower: 'Fruit/Flower',
        colorDish: 'Color/Dish',
    };

    useEffect(() => {
        socket.emit('joinRoom', { roomId, name });

        socket.on('roomUpdate', (room) => {
            const player = room.players.find((p: any) => p.name === name);
            if (player) setIsCurrentHost(player.isHost);
        });

        socket.on('roundResults', (payload) => {
            setResults(payload.results || {});
            setSummary(payload.summary || []);
            setNextLetter(payload.letter || '');
            setHostReady(true);
        });

        socket.on('scoresUpdated', (payload: { results: RoundResult; summary: PlayerSummary[] }) => {
            setResults(payload.results);
            setSummary(payload.summary);
        });

        socket.on('startRound', ({ round, letter }) => {
            router.replace({
                pathname: '/inputScreen',
                params: {
                    roomId,
                    name,
                    isHost,
                    round: String(round),
                    letter,
                },
            });
        });

        socket.emit('getFinalResults', { roomId });

        socket.on('gameOver', () => {
            router.replace({
                pathname: '/finalResultsScreen',
                params: { roomId, name },
            });
        });

        return () => {
            socket.off('roomUpdate');
            socket.off('roundResults');
            socket.off('scoresUpdated');
            socket.off('startRound');
        };
    }, []);

    const updatePoints = (category: string, player: string, newPoints: number) => {
        const updated = { ...results };
        updated[category] = updated[category].map(item =>
            item.player === player ? { ...item, points: newPoints } : item
        );
        setResults(updated);
        const newSummary = calculateSummaryWithBreakdown(updated);
        setSummary(newSummary);
        socket.emit('updateScores', { roomId, results: updated, summary: newSummary });
    };

    const markValid = (category: string, player: string) => {
        updatePoints(category, player, 10);
    };

    const splitPoints = (category: string, answerText: string) => {
        const updated = { ...results };
        updated[category] = updated[category].map(item =>
            item.answer.trim().toLowerCase() === answerText.trim().toLowerCase()
                ? { ...item, points: 5 }
                : item
        );
        setResults(updated);
        const newSummary = calculateSummaryWithBreakdown(updated);
        setSummary(newSummary);
        socket.emit('updateScores', { roomId, results: updated, summary: newSummary });
    };

    const calculateSummaryWithBreakdown = (updated: RoundResult): PlayerSummary[] => {
        const perPlayer: Record<string, { total: number; breakdown: Record<string, number> }> = {};
        for (const category in updated) {
            updated[category].forEach(({ player, points }) => {
                if (!perPlayer[player]) perPlayer[player] = { total: 0, breakdown: {} };
                perPlayer[player].total += points;
                perPlayer[player].breakdown[category] = points;
            });
        }
        return Object.entries(perPlayer).map(([player, obj]) => ({
            player,
            total: obj.total,
            breakdown: obj.breakdown
        }));
    };

    const onNext = () => {
        if (isCurrentHost) {
            socket.emit('startNextRound', { roomId });
        }
    };

    const onViewFinal = () => {
        socket.emit('endGame', { roomId });
        router.push({ pathname: '/finalResultsScreen', params: { roomId, name } });
    };

    if (!isCurrentHost && !hostReady) {
        return (
            <View className="flex-1 justify-center items-center p-4">
                <Text className="text-lg text-gray-500">Round {roundNumber} Complete</Text>
                <Text className="text-xl font-bold mt-2">Calculating Scores...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <ScrollView className="p-4">
                {/* Round Header */}
                <View className="bg-white p-5 rounded-2xl shadow mb-4 items-center">
                    <Text className="text-2xl font-bold text-gray-800">Round {roundNumber} Results</Text>
                    {nextLetter && (
                        <Text className="text-sm text-gray-600 mt-1">Letter: <Text className="font-semibold">{nextLetter}</Text></Text>
                    )}
                    {isCurrentHost && (
                        <View className="mt-2 items-center">
                            <Text className="text-yellow-700 font-medium bg-yellow-100 px-3 py-1 rounded-full text-sm">Room Creator</Text>
                            <Text className="text-xs text-gray-500 mt-1">Use ❌ to invalidate or ➗ to split</Text>
                        </View>
                    )}
                </View>

                {/* Scoring System */}
                <View className="bg-blue-100 p-4 rounded-2xl shadow mb-5">
                    <Text className="text-center font-bold text-blue-900">Scoring System</Text>
                    <View className="flex-row justify-around mt-2">
                        <Text className="text-green-600 text-sm">10 pts – Unique</Text>
                        <Text className="text-yellow-600 text-sm">5 pts – Similar</Text>
                        <Text className="text-red-600 text-sm">0 pts – Invalid</Text>
                    </View>
                </View>

                {/* Per-Category Results */}
                {Object.entries(results).map(([cat, arr]) => (
                    <View key={cat} className="mb-5 bg-white shadow p-4 rounded-2xl">
                        <Text className="text-lg font-bold text-gray-800 mb-3">{displayName[cat] || cat}</Text>
                        {arr.map(({ player, answer, points }) => (
                            <View
                                key={`${cat}-${player}`}
                                className="flex-row justify-between items-center bg-gray-50 rounded-xl px-4 py-2 mb-2"
                            >
                                <View className="w-1/2">
                                    <Text className="font-semibold text-gray-800">{player}</Text>
                                    <Text className="text-gray-600 text-sm">{answer}</Text>
                                </View>
                                <View className="flex-row items-center space-x-2">
                                    <Text
                                        className={`px-2 py-0.5 text-white mr-2 rounded-full text-sm font-semibold ${
                                            points === 10
                                                ? 'bg-green-600'
                                                : points === 5
                                                    ? 'bg-yellow-600'
                                                    : points === 0
                                                        ? 'bg-red-600'
                                                        : 'bg-blue-600'
                                        }`}
                                    >
                                        {points} pts
                                    </Text>
                                    {isCurrentHost && (
                                        <View className="flex-row space-x-1">
                                            <TouchableOpacity
                                                onPress={() => markValid(cat, player)}
                                                className=" rounded-full px-2 py-0.5 mr-1"
                                            >
                                                <Text className="text-white text-lg">✅</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                disabled={points === 0}
                                                onPress={() => updatePoints(cat, player, 0)}
                                                className={`rounded-full px-2 py-0.5 mr-1 ${
                                                    points === 0 ? 'bg-white-300' : 'bg-white-500'
                                                }`}
                                            >
                                                <Text className="text-white text-lg">❌</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => splitPoints(cat, answer)}
                                                className=" rounded-full px-2 py-0.5"
                                            >
                                                <Text className="text-white text-lg">➗</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                ))}

                {/* Round Summary */}
                <View className="mt-4 bg-white rounded-2xl shadow p-4">
                    <Text className="text-xl font-bold text-gray-800 mb-3">Round {roundNumber} Summary</Text>
                    {summary.map(({ player, total, breakdown }) => (
                        <View key={player} className="mb-3">
                            <Text className="font-semibold text-lg text-gray-800">{player} – {total} pts</Text>
                            <Text className="text-sm text-gray-600">
                                {Object.entries(breakdown)
                                    .map(([k, v]) => `${displayName[k] || k}: ${v}`)
                                    .join(', ')}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Host Buttons */}
                {isCurrentHost ? (
                    <View className="mt-6 space-y-3">
                        <TouchableOpacity className="bg-blue-600 py-3 rounded-2xl shadow mb-4" onPress={onNext}>
                            <Text className="text-center text-white text-lg font-semibold">Start New Round</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="bg-red-600 py-3 rounded-2xl shadow mb-12" onPress={onViewFinal}>
                            <Text className="text-center text-white text-lg font-semibold">View Final Results</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text className="mt-6 text-center text-gray-500 mb-12">Waiting for host to continue...</Text>
                )}
            </ScrollView>
        </SafeAreaView>

    );
}
