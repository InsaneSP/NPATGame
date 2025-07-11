const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// ✅ Health check endpoint
app.get('/', (req, res) => {
    res.send('✅ Socket.IO backend is live!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const rooms = {};
const categories = ['name', 'surname', 'place', 'animalBird', 'thing', 'movie', 'fruitFlower', 'colorDish'];

io.on('connection', socket => {
    let currentRoom = null;
    let playerName = null;

    socket.on('joinRoom', ({ roomId, name, isHost }) => {
        playerName = name;
        currentRoom = roomId;
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                currentRound: 1,
                currentLetter: '',
                usedLetters: [],
                answers: {},
                scores: {},
                statuses: [],
                pendingResults: null,
                breakdown: [],
                pendingResultsSent: false,
                gameEnded: false,
            };
        }

        const room = rooms[roomId];
        const alreadyHasHost = room.players.some(p => p.isHost);

        const alreadyInRoom = room.players.some(p => p.id === socket.id);
        if (!alreadyInRoom) {
            const playerObj = {
                id: socket.id,
                name,
                isHost: !alreadyHasHost && isHost,
            };
            room.players.push(playerObj);
            room.statuses.push({ id: socket.id, name });
        }

        io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('startGame', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.currentLetter = getRandomLetter(room);
        room.currentRound = 1;
        room.answers = {};
        room.pendingResults = null;
        room.pendingResultsSent = false;
        room.gameEnded = false;
        room.timeoutHandle = null;

        room.statuses = room.players.map(p => ({
            id: p.id,
            name: p.name,
            done: false,
        }));

        io.to(roomId).emit('gameStarted');
        io.to(roomId).emit('startRound', { round: room.currentRound, letter: room.currentLetter });
    });

    socket.on('submitAnswers', ({ player, roomId, answers }) => {
        const room = rooms[roomId];
        if (!room) return;

        const matchedPlayer = room.players.find(p => p.name === player);
        if (!matchedPlayer) return;

        room.answers[matchedPlayer.id] = answers;

        const enrichedStatuses = room.statuses.map(status => ({
            ...status,
            answers: room.answers[status.id],
        }));

        io.to(roomId).emit('answerUpdate', { playerId: matchedPlayer.id, answers });
        io.to(roomId).emit('playerStatusesUpdate', enrichedStatuses);

        const totalSubmitted = Object.keys(room.answers).length;
        const totalExpected = room.players.length;

        console.log(`📝 ${totalSubmitted}/${totalExpected} players submitted in room ${roomId}`);

        if (!room.pendingResultsSent) {
            // Always try to emit results after any submission
            tryEmitRoundResults(roomId);

            // Timer logic only applies to >2 players
            if (totalExpected > 2 && totalSubmitted === 2 && !room.timeoutHandle) {
                console.log(`⏳ Starting 10s timer for room ${roomId}`);
                io.to(roomId).emit('timerStarted', { duration: 10 });

                room.timeoutHandle = setTimeout(() => {
                    console.log(`⌛ Timer ended — auto-submitting remaining players in ${roomId}`);

                    room.players.forEach(p => {
                        if (!room.answers[p.id]) {
                            room.answers[p.id] = Object.fromEntries(categories.map(c => [c, '']));
                        }
                    });

                    tryEmitRoundResults(roomId);
                    room.timeoutHandle = null;
                }, 10000);
            }
        }
    });

    socket.on('getFinalResults', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.pendingResults) {
            io.to(socket.id).emit('roundResults', {
                roundNumber: room.currentRound,
                results: room.pendingResults.roundResult,
                summary: room.pendingResults.summary,
                isFinal: false,
                letter: room.currentLetter,
            });
        }

        if (room.gameEnded) {
            const scoreArr = Object.entries(room.scores || {}).map(([id, points]) => {
                const player = room.players.find(p => p.id === id);
                return player ? { name: player.name, points } : null;
            }).filter(Boolean).sort((a, b) => b.points - a.points);

            io.to(socket.id).emit('gameOver', {
                scores: scoreArr,
                winner: scoreArr[0],
                breakdown: room.breakdown,
            });
        }
    });

    socket.on('updateScores', ({ roomId, results, summary }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.pendingResults = {
            ...(room.pendingResults || {}),
            results,
            summary,
            isFinal: false,
        };

        // ✅ Overwrite breakdown for current round
        const currentRound = room.currentRound;

        const updatedBreakdown = {
            round: currentRound,
            scores: room.players.map(p => {
                const playerSummary = summary.find(s => s.player === p.name);
                const breakdown = playerSummary?.breakdown || {};
                return {
                    player: p.name,
                    ...Object.fromEntries(categories.map(c => [c, breakdown[c] || 0])),
                    total: playerSummary?.total || 0
                };
            })
        };

        const index = room.breakdown.findIndex(r => r.round === currentRound);
        if (index !== -1) {
            room.breakdown[index] = updatedBreakdown;
        } else {
            room.breakdown.push(updatedBreakdown);
        }

        // ✅ Notify players of update if needed
        io.to(roomId).emit('scoresUpdated', {
            results,
            summary,
            breakdown: room.breakdown,
        });
    });

    socket.on('startNextRound', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.pendingResults) return;

        room.pendingResults.summary.forEach(p => {
            const playerObj = room.players.find(pl => pl.name === p.player);
            if (!playerObj) return;
            room.scores[playerObj.id] = (room.scores[playerObj.id] || 0) + p.total;
        });

        room.currentRound++;
        room.answers = {};
        room.pendingResults = null;
        room.pendingResultsSent = false;
        room.timeoutHandle = null;

        room.currentLetter = getRandomLetter(room);
        room.statuses = room.players.map(p => ({
            id: p.id,
            name: p.name,
            done: false,
        }));

        io.to(roomId).emit('startRound', { round: room.currentRound, letter: room.currentLetter });
    });

    socket.on('hostValidateScores', ({ roomId, validatedResults }) => {
        const room = rooms[roomId];
        if (!room) return;

        validatedResults.forEach(p => {
            const playerObj = room.players.find(pl => pl.name === p.player);
            if (!playerObj) return;
            room.scores[playerObj.id] = (room.scores[playerObj.id] || 0) + p.total;
        });

        room.currentRound++;
        room.answers = {};
        room.pendingResults = null;
        room.pendingResultsSent = false;

        const randomLetter = getRandomLetter();
        room.currentLetter = randomLetter;

        room.statuses = room.players.map(p => ({
            id: p.id,
            name: p.name,
            done: false,
        }));

        io.to(roomId).emit('startRound', { round: room.currentRound, letter: randomLetter });
    });

    socket.on('endGame', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.gameEnded = true;

        if (room.pendingResults && room.pendingResults.summary) {
            room.pendingResults.summary.forEach(p => {
                const playerObj = room.players.find(pl => pl.name === p.player);
                if (!playerObj) return;
                room.scores[playerObj.id] = (room.scores[playerObj.id] || 0) + p.total;
            });
        }

        const scoreArr = Object.entries(room.scores || {}).map(([id, points]) => {
            const player = room.players.find(p => p.id === id);
            return player ? { name: player.name, points } : null;
        }).filter(Boolean).sort((a, b) => b.points - a.points);

        io.to(roomId).emit('gameOver', {
            scores: scoreArr,
            winner: scoreArr[0],
            breakdown: room.breakdown,
        });
    });

    socket.on('getPlayerStatuses', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            const enrichedStatuses = room.statuses.map(status => ({
                ...status,
                answers: room.answers[status.id]
            }));
            io.to(socket.id).emit('playerStatusesUpdate', enrichedStatuses);
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[currentRoom];
        if (!room) return;

        room.players = room.players.filter(p => p.id !== socket.id);
        room.statuses = room.statuses.filter(p => p.id !== socket.id);
        delete room.answers[socket.id];
        delete room.scores[socket.id];

        io.to(currentRoom).emit('roomUpdate', room);
        const enrichedStatuses = room.statuses.map(status => ({
            ...status,
            answers: room.answers[status.id]
        }));
        io.to(currentRoom).emit('playerStatusesUpdate', enrichedStatuses);
    });

    socket.on('restartGame', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Reset room state (but keep players!)
        room.currentRound = 1;
        room.currentLetter = getRandomLetter(room);
        room.answers = {};
        room.scores = {};
        room.statuses = room.players.map(p => ({ id: p.id, name: p.name, done: false }));
        room.pendingResults = null;
        room.breakdown = [];
        room.pendingResultsSent = false;
        room.gameEnded = false;
        room.timeoutHandle = null;

        // Notify clients to reset to round 1
        io.to(roomId).emit('startRound', {
            round: room.currentRound,
            letter: room.currentLetter,
        });
    });

});

function getRandomLetter(room) {
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const unused = allLetters.filter(letter => !room.usedLetters.includes(letter));

    if (unused.length === 0) {
        // All letters used, reset
        room.usedLetters = [];
        return getRandomLetter(room);
    }

    const randomIndex = Math.floor(Math.random() * unused.length);
    const selected = unused[randomIndex];
    room.usedLetters.push(selected);
    return selected;
}

function calculateRoundScores(allAnswers, letter) {
    const players = Object.keys(allAnswers);
    const res = {};

    players.forEach(id => (res[id] = { perCategory: {}, total: 0 }));

    categories.forEach(cat => {
        const freq = {};

        players.forEach(id => {
            const val = allAnswers[id][cat]?.trim().toLowerCase();
            if (!val || val[0] !== letter.toLowerCase()) {
                res[id].perCategory[cat] = 0;
                return;
            }
            freq[val] = (freq[val] || []).concat(id);
        });

        Object.entries(freq).forEach(([val, ids]) => {
            const pts = ids.length === 1 ? 10 : 5;
            ids.forEach(id => {
                res[id].perCategory[cat] = pts;
                res[id].total += pts;
            });
        });
    });

    return res;
}

function tryEmitRoundResults(roomId) {
    const room = rooms[roomId];
    if (!room || room.pendingResultsSent) return;

    const totalSubmitted = Object.keys(room.answers).length;
    const totalExpected = room.players.length;

    if (totalSubmitted !== totalExpected) return;

    const roundScores = calculateRoundScores(room.answers, room.currentLetter);

    const roundResult = {};
    categories.forEach(cat => {
        roundResult[cat] = room.players.map(p => ({
            id: p.id,
            player: p.name,
            answer: room.answers[p.id]?.[cat] || '',
            points: roundScores[p.id]?.perCategory?.[cat] || 0,
        }));
    });

    const summary = room.players.map(p => ({
        id: p.id,
        player: p.name,
        total: roundScores[p.id]?.total || 0,
        breakdown: roundScores[p.id]?.perCategory || {},
    }));

    room.pendingResults = { roundResult, summary, isFinal: false };
    room.pendingResultsSent = true;

    const roundBreakdown = {
        round: room.currentRound,
        scores: room.players.map(p => {
            const playerSummary = summary.find(s => s.player === p.name);
            const breakdown = playerSummary?.breakdown || {};
            return {
                player: p.name,
                ...Object.fromEntries(categories.map(c => [c, breakdown[c] || 0])),
                total: playerSummary?.total || 0
            };
        })
    };

    const existingIndex = room.breakdown.findIndex(b => b.round === room.currentRound);
    if (existingIndex === -1) {
        room.breakdown.push(roundBreakdown);
    } else {
        room.breakdown[existingIndex] = roundBreakdown;
    }

    io.to(roomId).emit('roundResults', {
        roundNumber: room.currentRound,
        results: roundResult,
        summary,
        isFinal: false,
        letter: room.currentLetter,
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Socket.IO server running on port ${PORT}`);
});
