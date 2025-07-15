import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Vibration,
    Keyboard,
    TouchableWithoutFeedback,
    BackHandler,
    Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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

    const initialAnswers: Answers = {
        name: '', surname: '', place: '', animalBird: '', thing: '', movie: '', fruitFlower: '', colorDish: ''
    };

    const [inputs, setInputs] = useState<Answers>(initialAnswers);
    const inputsRef = useRef<Answers>(initialAnswers);
    const [submitted, setSubmitted] = useState(false);
    const submittedRef = useRef(false);
    const [timeUp, setTimeUp] = useState(false);
    const [roundNum, setRoundNum] = useState<number>(parseInt(round) || 1);
    const [letter, setLetter] = useState<string>(initLetter || '');
    const [timer, setTimer] = useState<number>(0);

    const isCurrentHost = isHost === 'true';
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);

    const handleChange = (key: keyof Answers, value: string) => {
        const updated = { ...inputsRef.current, [key]: value };
        inputsRef.current = updated;
        setInputs(updated);
    };

    const handleSubmit = () => {
        if (submittedRef.current) return;
        socket.emit('submitAnswers', { player: name, roomId, answers: inputsRef.current });
        setSubmitted(true);
        submittedRef.current = true;
    };

    const playTimerSound = async () => {
        try {
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            }
            const { sound } = await Audio.Sound.createAsync(require('../assets/timer.mp3'));
            soundRef.current = sound;
            await sound.playAsync();
        } catch (error) {
            console.log('Sound error:', error);
        }
    };

    useEffect(() => {
        socket.emit('getPlayerStatuses', roomId);
        const fallback = setTimeout(() => socket.emit('getFinalResults', { roomId }), 2000);

        socket.on('roundResults', (payload) => {
            if (payload.letter) setLetter(payload.letter);
            setRoundNum(payload.roundNumber);
            clearInterval(timerRef.current!);
            soundRef.current?.stopAsync();
            soundRef.current?.unloadAsync();
            soundRef.current = null;

            router.replace({ pathname: '/resultsScreen', params: { name, roomId, isHost, round: String(payload.roundNumber) } });
        });

        socket.on('startRound', ({ round, letter }) => {
            clearInterval(timerRef.current!);
            soundRef.current?.stopAsync();
            soundRef.current?.unloadAsync();
            soundRef.current = null;

            const fresh = { ...initialAnswers };
            setInputs(fresh);
            inputsRef.current = fresh;
            setSubmitted(false);
            submittedRef.current = false;
            setTimeUp(false);
            setTimer(0);
            setRoundNum(round);
            setLetter(letter);
        });

        socket.on('timerStarted', ({ duration }) => {
            Vibration.vibrate(300);
            playTimerSound();
            setTimer(duration);
            setTimeUp(false);

            timerRef.current = setInterval(() => {
                setTimer(prev => {
                    const next = prev - 1;
                    if (next <= 0 && !submittedRef.current) {
                        clearInterval(timerRef.current!);
                        timerRef.current = null;
                        setTimeUp(true);

                        console.log('⌛ Auto-submitting current inputs...');
                        socket.emit('submitAnswers', {
                            player: name,
                            roomId,
                            answers: inputsRef.current,
                        });

                        setSubmitted(true);
                        submittedRef.current = true;
                        return 0;
                    }
                    return next;
                });
            }, 1000);
        });

        if (!initLetter) {
            setTimeout(() => {
                if (!letter) socket.emit('getFinalResults', { roomId });
            }, 1000);
        }

        return () => {
            clearTimeout(fallback);
            clearInterval(timerRef.current!);
            soundRef.current?.stopAsync();
            soundRef.current?.unloadAsync();
            soundRef.current = null;
            socket.off('roundResults');
            socket.off('startRound');
            socket.off('timerStarted');
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                Alert.alert('Leave Game?', 'Going back will exit the game. Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Yes', style: 'destructive', onPress: () => router.back() },
                ]);
                return true;
            };
            const handler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => handler.remove();
        }, [])
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} style={{ flex: 1 }}>
                    <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="always">
                        {submitted && !isCurrentHost ? (
                            <View className="flex-1 justify-center items-center mt-40">
                                <Text className="text-2xl font-bold text-gray-800 mb-2">🎉 Round {roundNum} Complete</Text>
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
                                        <Text className="text-sm text-center px-2 py-1 mt-2 rounded-full font-medium bg-yellow-200 text-yellow-900">You are the Host</Text>
                                    )}
                                </View>

                                {timer > 0 && (
                                    <View className="mb-4 bg-yellow-100 border border-yellow-300 p-3 rounded-xl">
                                        <Text className="text-center text-yellow-800 font-semibold">⏳ Hurry! {timer} seconds remaining to submit!</Text>
                                    </View>
                                )}

                                {timeUp && !submitted && (
                                    <View className="mb-4 bg-red-100 border border-red-300 p-3 rounded-xl">
                                        <Text className="text-center text-red-800 font-semibold">⏰ Time's up! Please submit your answers now.</Text>
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
                                            editable={!submitted && !timeUp}
                                        />
                                    </View>
                                ))}

                                {submitted ? (
                                    <Text className="text-center bg-green-100 text-green-700 py-2 rounded-xl mt-6 font-medium">✅ Answers Submitted!</Text>
                                ) : (
                                    <TouchableOpacity
                                        className={`${timeUp ? 'bg-red-600' : 'bg-blue-600'} py-3 rounded-xl mt-6 mb-12`}
                                        onPress={handleSubmit}
                                    >
                                        <Text className="text-center text-white font-semibold text-lg">{timeUp ? 'Submit (Time Over)' : 'Submit Answers'}</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

export default InputScreen;
