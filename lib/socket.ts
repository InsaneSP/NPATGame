import { io } from 'socket.io-client';

const socket = io('https://npatgame.onrender.com', {
    transports: ['websocket'],
    forceNew: true,
});

export default socket;
