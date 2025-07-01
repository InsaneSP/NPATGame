import { io } from 'socket.io-client';
import { SOCKET_SERVER_URL } from '@env';

const socket = io(SOCKET_SERVER_URL, {
    transports: ['websocket'],
});

export default socket;
