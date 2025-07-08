import { io } from 'socket.io-client';

const socket = io('https://npatgame.onrender.com', {
    transports: ['websocket'],
    forceNew: true,
});

socket.on('connect', () => console.log('✅ Connected to socket'));
socket.on('connect_error', (err) => console.log('❌ Socket error:', err));

export default socket;
