import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Vibration
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import socket from '../lib/socket';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';

type Answers = {
    name: string;
    surname: string;
    place: string;
    animalBird: string;
    thing: string;
    movie: string;
    fruitFlower: string;
    colorDish: string;
};

type PlayerStatus = {
    id: string;
    name: string;
    done: boolean;
};

type PlayerAnswerView = {
    id: string;
    name: string;
    done: boolean;
    answers?: Answers;
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

const getSingleValue = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0] || '';
    return param || '';
};

const InputScreen = () => {
    const params = useLocalSearchParams();
    const name = getSingleValue(params.name);
    const roomId = getSingleValue(params.roomId);
    const isHost = getSingleValue(params.isHost);
    const round = getSingleValue(params.round);
    const initLetter = getSingleValue(params.letter);

    const router = useRouter();

    const [inputs, setInputs] = useState<Answers>({
        name: '',
        surname: '',
        place: '',
        animalBird: '',
        thing: '',
        movie: '',
        fruitFlower: '',
        colorDish: '',
    });

    const [submitted, setSubmitted] = useState(false);
    const [playerStatuses, setPlayerStatuses] = useState<PlayerStatus[]>([]);
    const [answersById, setAnswersById] = useState<Record<string, Answers>>({});
    const [roundNum, setRoundNum] = useState<number>(parseInt(round) || 1);
    const [letter, setLetter] = useState<string>(initLetter || '');
    const [timer, setTimer] = useState<number>(0);

    const isCurrentHost = isHost === 'true';

    const handleChange = (key: keyof Answers, value: string) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        socket.emit('submitAnswers', {
            player: name,
            roomId,
            answers: inputs,
        });
        setSubmitted(true);
    };

    const playTimerSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../assets/timer.mp3') // 🔊 Make sure this file exists
            );
            await sound.playAsync();
        } catch (error) {
            console.log('Sound error:', error);
        }
    };

    useEffect(() => {
        socket.emit('getPlayerStatuses', roomId);

        const fallback = setTimeout(() => {
            socket.emit('getFinalResults', { roomId });
        }, 2000);

        socket.on('playerStatusesUpdate', (statusList: PlayerStatus[]) => {
            setPlayerStatuses(statusList);
        });

        socket.on('answerUpdate', ({ playerId, answers }) => {
            setAnswersById(prev => ({
                ...prev,
                [playerId]: answers,
            }));
        });

        socket.on('roundResults', (payload) => {
            if (payload.letter) setLetter(payload.letter);
            setRoundNum(payload.roundNumber);
            router.replace({
                pathname: '/resultsScreen',
                params: {
                    name,
                    roomId,
                    isHost,
                    round: String(payload.roundNumber),
                },
            });
        });

        socket.on('startRound', ({ round, letter }) => {
            setRoundNum(round);
            setLetter(letter);
            setInputs({
                name: '',
                surname: '',
                place: '',
                animalBird: '',
                thing: '',
                movie: '',
                fruitFlower: '',
                colorDish: '',
            });
            setSubmitted(false);
            setTimer(0);
        });

        socket.on('timerStarted', ({ duration }) => {
            Vibration.vibrate(300);
            playTimerSound();
            setTimer(duration);
            const interval = setInterval(() => {
                setTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        if (!initLetter) {
            setTimeout(() => {
                if (!letter) {
                    socket.emit('getFinalResults', { roomId });
                }
            }, 1000);
        }

        return () => {
            clearTimeout(fallback);
            socket.off('playerStatusesUpdate');
            socket.off('answerUpdate');
            socket.off('roundResults');
            socket.off('startRound');
            socket.off('timerStarted');
        };
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <KeyboardAvoidingView
                behavior="height"
                className="flex-1"
            >
                <ScrollView
                    className="p-4"
                    contentContainerStyle={{ paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {submitted && !isCurrentHost ? (
                        <View className="flex-1 justify-center items-center mt-40">
                            <Text className="text-2xl font-bold text-gray-800 mb-2">🎉 Round Complete</Text>
                            <Text className="text-base text-gray-600">Waiting for others to submit...</Text>
                        </View>
                    ) : (
                        <>
                            <View className="bg-white p-5 rounded-2xl shadow-md mb-6">
                                <Text className="text-lg font-semibold text-gray-800">Round {roundNum}</Text>
                                <Text className="text-2xl font-bold text-blue-800">Letter: {letter || '...'}</Text>
                                <Text className="text-sm text-gray-600 mt-1 text-center">
                                    Type words that start with <Text className="font-bold">"{letter || '?'}"</Text>
                                </Text>
                                {isCurrentHost && (
                                    <Text className="text-sm text-center px-2 py-1 mt-2 rounded-full font-medium bg-yellow-200 text-yellow-900">
                                        You are the Host
                                    </Text>
                                )}
                            </View>

                            {timer > 0 && (
                                <View className="mb-4 bg-yellow-100 border border-yellow-300 p-3 rounded-xl">
                                    <Text className="text-center text-yellow-800 font-semibold">
                                        ⏳ Hurry! {timer} seconds remaining to submit!
                                    </Text>
                                </View>
                            )}

                            {categories.map(({ key, label }) => (
                                <View key={key} className="mb-4">
                                    <Text className="text-base font-medium text-gray-800 mb-1">{label}</Text>
                                    <TextInput
                                        className="border border-gray-300 rounded-xl bg-white px-3 py-2 shadow-sm"
                                        placeholder={`Enter ${label.toLowerCase()}`}
                                        value={inputs[key as keyof Answers]}
                                        onChangeText={(text) => handleChange(key as keyof Answers, text)}
                                        editable={!submitted}
                                    />
                                </View>
                            ))}

                            {submitted ? (
                                <Text className="text-center bg-green-100 text-green-700 py-2 rounded-xl mt-6 font-medium">
                                    ✅ Answers Submitted!
                                </Text>
                            ) : (
                                <TouchableOpacity
                                    className="bg-blue-600 py-3 rounded-xl mt-6 mb-12"
                                    onPress={handleSubmit}
                                >
                                    <Text className="text-center text-white font-semibold text-lg">Submit Answers</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default InputScreen;
