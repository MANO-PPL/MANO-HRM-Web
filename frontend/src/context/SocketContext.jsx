import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getAccessToken } from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const token = getAccessToken();
        
        // Connect to the WebSocket server sharing the same origin / proxy path
        const newSocket = io({
            path: '/socket.io/',
            auth: {
                token: token ? `Bearer ${token}` : undefined
            },
            reconnectionAttempts: 5,
            reconnectionDelay: 2000
        });

        newSocket.on('connect', () => {
            // Socket channel established successfully.
        });

        newSocket.on('connect_error', (error) => {
            // Socket connection error handles silently.
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
