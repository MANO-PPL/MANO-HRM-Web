import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
    Send, Plus, Search, MessageSquare, Users, Hash, 
    Video, Phone, MoreVertical, Smile, CheckCheck, 
    ArrowLeft, UserPlus, X, Volume2, Info, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

const ChatPage = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const currentUserId = user?.user_id ?? user?.id;

    // Active states
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [coworkers, setCoworkers] = useState([]);
    
    // UI Filters / Triggers
    const [sidebarTab, setSidebarTab] = useState('all'); // 'all' | 'direct' | 'group'
    const [searchQuery, setSearchQuery] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showDmModal, setShowDmModal] = useState(false);
    
    // Group Form State
    const [groupName, setGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    const [dmSearchQuery, setDmSearchQuery] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    const openDmModal = () => {
        setDmSearchQuery('');
        setShowDmModal(true);
    };

    const openGroupModal = () => {
        setGroupSearchQuery('');
        setGroupName('');
        setSelectedGroupMembers([]);
        setShowGroupModal(true);
    };

    // Typing Indicators State
    const [typingUsers, setTypingUsers] = useState({}); // { roomId: { userId: username } }
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef(null);

    // Mention Dropdown State
    const [activeMention, setActiveMention] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const chatInputRef = useRef(null);

    // Layout/Mobile responsive states
    const [showMobileChatWindow, setShowMobileChatWindow] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    
    const messagesEndRef = useRef(null);

    // Load initial data
    useEffect(() => {
        fetchRooms();
        fetchCoworkers();
    }, []);

    // Set up Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (message) => {
            // If the message belongs to the currently active room, append it and mark as read
            if (selectedRoom && Number(selectedRoom.room_id) === Number(message.room_id)) {
                setMessages(prev => {
                    if (prev.some(m => m.message_id === message.message_id)) return prev;
                    return [...prev, message];
                });
                markRoomAsRead(message.room_id);
            }
            
            // Refresh room previews to show latest message and update unread count
            fetchRooms(false);
        };

        const handleUserTyping = ({ roomId, userId, username }) => {
            if (Number(userId) === Number(currentUserId)) return;
            setTypingUsers(prev => ({
                ...prev,
                [roomId]: {
                    ...(prev[roomId] || {}),
                    [userId]: username
                }
            }));
        };

        const handleUserStopTyping = ({ roomId, userId }) => {
            setTypingUsers(prev => {
                const nextTyping = { ...(prev[roomId] || {}) };
                delete nextTyping[userId];
                return {
                    ...prev,
                    [roomId]: nextTyping
                };
            });
        };

        socket.on('message_received', handleIncomingMessage);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);

        // If a room is selected, join its socket room
        if (selectedRoom) {
            socket.emit('join_room', selectedRoom.room_id);
        }

        return () => {
            socket.off('message_received', handleIncomingMessage);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
            if (selectedRoom) {
                socket.emit('leave_room', selectedRoom.room_id);
            }
        };
    }, [socket, selectedRoom, currentUserId]);

    // Scroll to bottom of message thread
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchRooms = async (showLoading = true) => {
        if (showLoading) setLoadingRooms(true);
        try {
            const res = await api.get('/collaboration/rooms');
            if (res.data.success) {
                setRooms(res.data.data);
                
                // Keep selected room details updated
                if (selectedRoom) {
                    const updatedSelected = res.data.data.find(r => r.room_id === selectedRoom.room_id);
                    if (updatedSelected) setSelectedRoom(updatedSelected);
                }
            }
        } catch (err) {
            // Failed to load rooms
        } finally {
            if (showLoading) setLoadingRooms(false);
        }
    };

    const fetchCoworkers = async () => {
        try {
            const res = await api.get('/collaboration/users');
            if (res.data.success) {
                setCoworkers(res.data.data);
            }
        } catch (err) {
            // Failed to load directory
        }
    };

    const fetchMessages = async (roomId) => {
        setLoadingMessages(true);
        try {
            const res = await api.get(`/collaboration/rooms/${roomId}/messages`);
            if (res.data.success) {
                setMessages(res.data.data);
            }
        } catch (err) {
            toast.error("Failed to load message history.");
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleRoomSelect = (room) => {
        if (socket && selectedRoom) {
            socket.emit('leave_room', selectedRoom.room_id);
        }
        setSelectedRoom(room);
        fetchMessages(room.room_id);
        markRoomAsRead(room.room_id);
        setShowMobileChatWindow(true);
        setNewMessageText('');
    };

    const markRoomAsRead = async (roomId) => {
        try {
            await api.put(`/collaboration/rooms/${roomId}/read`);
            setRooms(prev => prev.map(r => 
                r.room_id === roomId ? { ...r, unread_count: 0 } : r
            ));
        } catch (err) {
            // Failed to mark room read
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!newMessageText.trim() || !selectedRoom) return;

        const textToSend = newMessageText;
        setNewMessageText('');
        setActiveMention(false);
        
        // Stop typing indicator instantly on send
        stopTypingIndicator();

        try {
            await api.post(`/collaboration/rooms/${selectedRoom.room_id}/messages`, {
                message_text: textToSend
            });
            // Handled automatically via 'message_received' socket listener or refetching
        } catch (err) {
            toast.error("Message delivery failed.");
        }
    };

    const startTypingIndicator = () => {
        if (!socket || !selectedRoom) return;
        
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing', { roomId: selectedRoom.room_id, username: user?.user_name });
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(stopTypingIndicator, 3000);
    };

    const stopTypingIndicator = () => {
        if (!socket || !selectedRoom || !isTypingRef.current) return;
        isTypingRef.current = false;
        socket.emit('stop_typing', { roomId: selectedRoom.room_id });
    };

    const handleInputChange = (val) => {
        setNewMessageText(val);
        startTypingIndicator();

        // Mention autocomplete activation logic
        const lastAtIndex = val.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || val[lastAtIndex - 1] === ' ')) {
            const search = val.substring(lastAtIndex + 1);
            if (search.length < 20 && !search.includes(' ')) {
                setActiveMention(true);
                setMentionSearch(search);
                return;
            }
        }
        setActiveMention(false);
    };

    const handleMentionSelect = (colleague) => {
        const val = newMessageText;
        const lastAtIndex = val.lastIndexOf('@');
        const prefix = val.substring(0, lastAtIndex);
        setNewMessageText(`${prefix}@${colleague.user_name} `);
        setActiveMention(false);
        chatInputRef.current?.focus();
    };

    const initiateDM = async (otherUser) => {
        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'direct',
                member_ids: [otherUser.user_id]
            });
            if (res.data.success) {
                await fetchRooms();
                setShowDmModal(false);
                
                // Load this DM room
                const targetRoom = res.data.data;
                // If it is newly created, format it locally for immediate loading
                const formattedRoom = {
                    ...targetRoom,
                    room_name: otherUser.user_name,
                    avatar_url: otherUser.profile_image_url,
                    unread_count: 0
                };
                handleRoomSelect(formattedRoom);
            }
        } catch (err) {
            toast.error("Could not start chat conversation.");
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            return toast.error("Please enter a group name");
        }
        if (selectedGroupMembers.length === 0) {
            return toast.error("Please select at least one group member");
        }

        try {
            const res = await api.post('/collaboration/rooms', {
                room_type: 'group',
                room_name: groupName,
                member_ids: selectedGroupMembers
            });
            if (res.data.success) {
                toast.success("Group created successfully!");
                setGroupName('');
                setSelectedGroupMembers([]);
                setShowGroupModal(false);
                fetchRooms();
                handleRoomSelect(res.data.data);
            }
        } catch (err) {
            toast.error("Could not create collaboration group.");
        }
    };

    const toggleMemberSelection = (userId) => {
        setSelectedGroupMembers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    // Filter conversations based on sidebarTab and searchQuery
    const filteredRooms = rooms.filter(room => {
        const matchesTab = 
            sidebarTab === 'all' || 
            (sidebarTab === 'direct' && room.room_type === 'direct') ||
            (sidebarTab === 'group' && room.room_type === 'group');

        const matchesSearch = 
            room.room_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.last_message?.text?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatLocalTime = (createdAt) => {
        if (!createdAt) return '';
        try {
            let date;
            if (typeof createdAt === 'string') {
                // If it is a timezone-less string, normalize to ISO and append 'Z' to treat as UTC
                if (!createdAt.includes('Z') && !createdAt.includes('+') && !createdAt.includes('T')) {
                    const normalized = createdAt.trim().replace(' ', 'T');
                    date = new Date(normalized + 'Z');
                } else if (!createdAt.includes('Z') && !createdAt.includes('+') && createdAt.includes('T')) {
                    date = new Date(createdAt + 'Z');
                } else {
                    date = new Date(createdAt);
                }
            } else {
                date = new Date(createdAt);
            }
            
            if (isNaN(date.getTime())) return '';
            
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
        } catch (e) {
            return '';
        }
    };

    return (
        <DashboardLayout title="Chat & Collaboration">
            <div className="flex bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden h-[calc(100vh-85px)] relative">
                
                {/* 1. SIDEBAR: Channels & Direct Messages List */}
                <div className={`w-full md:w-80 lg:w-96 shrink-0 border-r border-slate-200 dark:border-github-dark-border flex flex-col bg-white dark:bg-github-dark-subtle transition-all duration-300 ${showMobileChatWindow ? 'hidden md:flex' : 'flex'}`}>
                    
                    {/* Header: User Controls */}
                    <div className="h-16 px-4 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between shrink-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-github-dark-text tracking-tight">Messages</h2>
                        
                        <div className="flex items-center gap-2">
                            {/* New DM Button */}
                            <button 
                                onClick={openDmModal}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                title="New DM"
                            >
                                <MessageSquare size={18} />
                            </button>

                            {/* New Group Button */}
                            <button 
                                onClick={openGroupModal}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                title="New Group"
                            >
                                <Users size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="p-3">
                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-gray-200 placeholder-slate-400"
                            />
                            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    {/* Sidebar Tabs */}
                    <div className="px-3 pb-2 flex border-b border-slate-100 dark:border-github-dark-border/50">
                        {['all', 'direct', 'group'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSidebarTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                                    sidebarTab === tab 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100/50 dark:divide-github-dark-border/30 custom-scrollbar">
                        {loadingRooms ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                <span className="text-xs text-slate-400">Loading chats...</span>
                            </div>
                        ) : filteredRooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center h-48">
                                <MessageSquare size={36} className="text-slate-300 mb-2 opacity-60" />
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">No Conversations</h4>
                                <p className="text-[10px] text-slate-400 mt-1">Start a direct chat or create a group to collaborate.</p>
                            </div>
                        ) : (
                            filteredRooms.map((room) => {
                                const isSelected = selectedRoom?.room_id === room.room_id;
                                const isGroup = room.room_type === 'group';
                                const activeTyping = typingUsers[room.room_id] || {};
                                const typingNames = Object.values(activeTyping);

                                return (
                                    <button
                                        key={room.room_id}
                                        onClick={() => handleRoomSelect(room)}
                                        className={`w-full text-left p-3.5 flex items-center gap-3.5 transition-colors cursor-pointer border-none outline-none ${
                                            isSelected 
                                            ? 'bg-indigo-50/50 dark:bg-github-dark-border/40' 
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 bg-transparent'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            {isGroup ? (
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                                                    <Users size={18} />
                                                </div>
                                            ) : room.avatar_url ? (
                                                <img src={room.avatar_url} alt={room.room_name} className="w-10 h-10 rounded-xl object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                    {getInitials(room.room_name)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta Previews */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-xs font-bold text-slate-700 dark:text-github-dark-text truncate">{room.room_name}</h4>
                                                
                                                {/* Timestamp */}
                                                {room.last_message && (
                                                    <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                                        {formatLocalTime(room.last_message.created_at)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Preview text */}
                                            {typingNames.length > 0 ? (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium animate-pulse truncate block">
                                                    typing...
                                                </span>
                                            ) : room.last_message ? (
                                                <p className="text-[10px] text-slate-400 truncate dark:text-gray-400 block">
                                                    {room.last_message.sender_id === currentUserId ? 'You: ' : ''}
                                                    {room.last_message.text}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-slate-300 dark:text-slate-600 italic block">No messages yet</p>
                                            )}
                                        </div>

                                        {/* Unread Badge */}
                                        {room.unread_count > 0 && (
                                            <span className="shrink-0 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                                                {room.unread_count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. MAIN WORKSPACE: Message thread pane */}
                <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-github-dark-subtle/40 h-full ${showMobileChatWindow ? 'flex' : 'hidden md:flex'}`}>
                    {selectedRoom ? (
                        <>
                            {/* Window Top Bar Header */}
                            <div className="h-16 px-4 border-b border-slate-200 dark:border-github-dark-border bg-white dark:bg-github-dark-subtle flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Back Button (Mobile Only) */}
                                    <button 
                                        onClick={() => setShowMobileChatWindow(false)}
                                        className="p-1 md:hidden text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>

                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        {selectedRoom.room_type === 'group' ? (
                                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                                                <Users size={18} />
                                            </div>
                                        ) : selectedRoom.avatar_url ? (
                                            <img src={selectedRoom.avatar_url} alt={selectedRoom.room_name} className="w-10 h-10 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                {getInitials(selectedRoom.room_name)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info text */}
                                    <div className="truncate">
                                        <h3 className="text-xs font-black text-slate-700 dark:text-github-dark-text truncate uppercase tracking-wider">{selectedRoom.room_name}</h3>
                                        
                                        {/* Status Detail */}
                                        {Object.values(typingUsers[selectedRoom.room_id] || {}).length > 0 ? (
                                            <span className="text-[9px] text-indigo-500 font-semibold animate-pulse">
                                                typing...
                                            </span>
                                        ) : selectedRoom.room_type === 'group' ? (
                                            <span className="text-[9px] text-slate-400">
                                                {selectedRoom.members?.length || 0} members
                                            </span>
                                        ) : (
                                            <span className="text-[9px] text-emerald-500 font-semibold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Phone size={16} /></button>
                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Video size={16} /></button>
                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><MoreVertical size={16} /></button>
                                </div>
                            </div>

                            {/* Message Panel Area */}
                            <div className="flex-1 overflow-y-auto p-3.5 space-y-2 custom-scrollbar">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        <span className="text-xs text-slate-400">Loading messages...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                        {/* E2EE Banner for empty state */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 mb-6 bg-slate-100/60 dark:bg-github-dark-border/40 border border-slate-200/50 dark:border-github-dark-border/60 rounded-xl text-[10px] text-slate-500 dark:text-github-dark-muted font-semibold shadow-sm max-w-xs sm:max-w-sm text-center">
                                            <Lock size={12} className="shrink-0 text-slate-400 dark:text-github-dark-muted" />
                                            <span>Messages are secured with end-to-end encryption.</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                                            <MessageSquare size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Messages Yet</h4>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm">Say hello! Type your first message below. You can use @ to mention teammates.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* E2EE Banner for active state */}
                                        <div className="flex justify-center mb-4 mt-1">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/60 dark:bg-github-dark-border/40 border border-slate-200/50 dark:border-github-dark-border/60 rounded-xl text-[10px] text-slate-500 dark:text-github-dark-muted font-semibold shadow-sm max-w-xs sm:max-w-sm text-center">
                                                <Lock size={12} className="shrink-0 text-slate-400 dark:text-github-dark-muted" />
                                                <span>Messages are secured with end-to-end encryption.</span>
                                            </div>
                                        </div>
                                        {messages.map((msg, idx) => {
                                            const isSelf = Number(msg.sender_id) === Number(currentUserId);
                                            const hasAvatar = msg.profile_image_url;
                                            
                                            // Detect if this message mentions current user
                                            const matchesMention = msg.message_text.includes(`@${user?.user_name}`);

                                            return (
                                                <div 
                                                    key={msg.message_id || idx}
                                                    className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                                                >
                                                    {/* Avatar */}
                                                    {!isSelf && (
                                                        <div className="shrink-0 mb-1">
                                                            {hasAvatar ? (
                                                                <img src={msg.profile_image_url} alt={msg.user_name} className="w-5 h-5 rounded-lg object-cover" />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[8px]">
                                                                    {msg.user_name?.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col">
                                                        {/* Sender name for groups */}
                                                        {!isSelf && selectedRoom.room_type === 'group' && (
                                                            <span className="text-[9px] text-slate-400 font-bold ml-1.5 mb-0.5">{msg.user_name}</span>
                                                        )}

                                                        {/* Message bubble */}
                                                        <div className={`py-1.5 px-3 rounded-xl shadow-sm text-xs leading-normal relative ${
                                                            isSelf 
                                                            ? 'bg-indigo-600 dark:bg-indigo-900 text-white rounded-br-none' 
                                                            : matchesMention
                                                                ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-slate-800 dark:text-amber-300 rounded-bl-none'
                                                                : 'bg-white dark:bg-github-dark-subtle text-slate-700 dark:text-gray-200 border border-slate-100 dark:border-github-dark-border/50 rounded-bl-none'
                                                        }`}>
                                                            
                                                            {/* Text formatting with mentions styling */}
                                                            <span className="whitespace-pre-wrap font-medium">
                                                                {(() => {
                                                                    // Convert @Names to stylized pills inside message bubble
                                                                    const parts = msg.message_text.split(/(@[a-zA-Z0-9\s._-]+)/g);
                                                                    return parts.map((part, i) => {
                                                                        if (part.startsWith('@')) {
                                                                            return (
                                                                                <span key={i} className={`px-1.5 py-0.5 rounded font-bold ${
                                                                                    isSelf 
                                                                                    ? 'bg-indigo-500 text-white' 
                                                                                    : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                                                                                }`}>
                                                                                    {part}
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return part;
                                                                    });
                                                                })()}
                                                            </span>

                                                            {/* Timestamp and ticks inside bubble */}
                                                            <div className="flex items-center justify-end gap-1 text-[8px] mt-1 opacity-60">
                                                                <span>
                                                                    {formatLocalTime(msg.created_at)}
                                                                </span>
                                                                {isSelf && <CheckCheck size={10} className="text-white opacity-85" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input Panel */}
                            <div className="p-4 bg-white dark:bg-github-dark-subtle border-t border-slate-200 dark:border-github-dark-border relative shrink-0">
                                
                                {/* Mention Suggestions Dropdown */}
                                <AnimatePresence>
                                    {activeMention && (
                                        (() => {
                                            const candidateUsers = (selectedRoom?.room_type === 'group' && selectedRoom?.members)
                                                ? selectedRoom.members.filter(m => Number(m.user_id) !== Number(currentUserId))
                                                : coworkers;
                                            const filtered = candidateUsers.filter(u => 
                                                u.user_name.toLowerCase().includes(mentionSearch.toLowerCase())
                                            ).slice(0, 5);

                                            if (filtered.length === 0) return null;

                                            return (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 15 }}
                                                    className="absolute left-4 right-4 bottom-full mb-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1 max-h-48"
                                                >
                                                    <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 tracking-wider">
                                                        Mention Team Member
                                                    </div>
                                                    {filtered.map(u => (
                                                        <button
                                                            key={u.user_id}
                                                            type="button"
                                                            onClick={() => handleMentionSelect(u)}
                                                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-3 transition-colors border-none bg-transparent cursor-pointer"
                                                        >
                                                            {u.profile_image_url ? (
                                                                <img src={u.profile_image_url} alt={u.user_name} className="w-6 h-6 rounded-lg object-cover" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                                                                    {u.user_name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="font-bold text-gray-700 dark:text-github-dark-text">{u.user_name}</div>
                                                                <div className="text-[9px] text-gray-400 dark:text-gray-500">{u.dept_name || 'Staff'} • {u.desg_name || 'Member'}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            );
                                        })()
                                    )}
                                </AnimatePresence>

                                <form onSubmit={handleSend} className="flex items-center gap-3">
                                    <button 
                                        type="button"
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                    >
                                        <Smile size={20} />
                                    </button>

                                    {/* Text Area Input */}
                                    <input 
                                        ref={chatInputRef}
                                        type="text"
                                        placeholder="Type a message... Use @ to tag people"
                                        value={newMessageText}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-700 dark:text-gray-200 placeholder-slate-400"
                                    />

                                    {/* Send Trigger */}
                                    <button 
                                        type="submit"
                                        disabled={!newMessageText.trim()}
                                        className={`p-3 rounded-xl transition-all shadow-md active:scale-95 border-none cursor-pointer flex items-center justify-center ${
                                            newMessageText.trim() 
                                            ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' 
                                            : 'bg-slate-100 text-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        <Send size={16} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        // Blank state visual mockup
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-github-dark-subtle/20">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-bounce">
                                    <MessageSquare size={36} />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-lg">
                                    <Plus size={16} />
                                </div>
                            </div>
                            
                            <h3 className="text-sm font-black text-slate-700 dark:text-github-dark-text tracking-wider uppercase mb-1">Collaboration Hub</h3>
                            <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">Connect with team members inside your organization. Make group channels, tag people like Instagram, and keep updates synchronized instantly.</p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    onClick={openDmModal}
                                    className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm transition-all hover:bg-slate-50 cursor-pointer"
                                >
                                    Start Direct Chat
                                </button>
                                <button 
                                    onClick={openGroupModal}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all cursor-pointer"
                                >
                                    Create Group Channel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODAL A: DIRECT MESSAGE INITIATOR --- */}
                <AnimatePresence>
                    {showDmModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden shadow-2xl"
                            >
                                <div className="p-4 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text uppercase tracking-wider">New Conversation</h3>
                                    <button onClick={() => setShowDmModal(false)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X size={16} /></button>
                                </div>

                                {/* Search Input for Coworkers */}
                                <div className="px-4 pt-3 pb-1 shrink-0">
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="Search coworkers..."
                                            value={dmSearchQuery}
                                            onChange={(e) => setDmSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-gray-200 placeholder-slate-400"
                                        />
                                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                                
                                <div className="p-4 max-h-[300px] overflow-y-auto space-y-2.5 custom-scrollbar">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Select a coworker</p>
                                    {(() => {
                                        const filteredDmCoworkers = coworkers.filter(colleague => 
                                            colleague.user_name.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                                            colleague.dept_name?.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                                            colleague.desg_name?.toLowerCase().includes(dmSearchQuery.toLowerCase())
                                        );

                                        if (filteredDmCoworkers.length === 0) {
                                            return <p className="text-xs text-slate-400 italic text-center py-8">No matching coworkers found.</p>;
                                        }

                                        return filteredDmCoworkers.map((colleague) => (
                                            <button
                                                key={colleague.user_id}
                                                onClick={() => initiateDM(colleague)}
                                                className="w-full p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 focus:bg-slate-100 dark:focus:bg-github-dark-border/40 focus:outline-none rounded-xl flex items-center gap-3 border-none bg-transparent cursor-pointer transition-colors"
                                            >
                                                {colleague.profile_image_url ? (
                                                    <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                        {getInitials(colleague.user_name)}
                                                    </div>
                                                )}
                                                <div className="truncate">
                                                    <div className="font-bold text-xs text-slate-700 dark:text-github-dark-text truncate">{colleague.user_name}</div>
                                                    <div className="text-[9px] text-slate-400 truncate">{colleague.dept_name || 'Staff'} • {colleague.desg_name || 'Member'}</div>
                                                </div>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* --- MODAL B: GROUP CREATION DIALOG --- */}
                <AnimatePresence>
                    {showGroupModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                            >
                                <div className="p-4 border-b border-slate-100 dark:border-github-dark-border flex items-center justify-between shrink-0">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-github-dark-text uppercase tracking-wider">Create Group Channel</h3>
                                    <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X size={16} /></button>
                                </div>

                                <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Group Name input */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Group Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Project Delivery sync"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-github-dark-border text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>

                                    {/* Members selection */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Select Team Members</label>
                                        
                                        {/* Search Input */}
                                        <div className="relative mb-2">
                                            <input 
                                                type="text"
                                                placeholder="Search members to add..."
                                                value={groupSearchQuery}
                                                onChange={(e) => setGroupSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-github-dark-border focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-gray-200 placeholder-slate-400"
                                            />
                                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        </div>

                                        <div className="space-y-2 max-h-[180px] overflow-y-auto p-1 custom-scrollbar">
                                            {(() => {
                                                const filteredGroupCoworkers = coworkers.filter(colleague => 
                                                    colleague.user_name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                                                    colleague.dept_name?.toLowerCase().includes(groupSearchQuery.toLowerCase())
                                                );

                                                if (filteredGroupCoworkers.length === 0) {
                                                    return <p className="text-xs text-slate-400 italic text-center py-4">No matching members found.</p>;
                                                }

                                                return filteredGroupCoworkers.map((colleague) => {
                                                    const isChecked = selectedGroupMembers.includes(colleague.user_id);
                                                    return (
                                                        <button
                                                            key={colleague.user_id}
                                                            type="button"
                                                            onClick={() => toggleMemberSelection(colleague.user_id)}
                                                            className={`w-full p-2 rounded-xl flex items-center justify-between cursor-pointer border transition-colors focus:bg-slate-100 dark:focus:bg-github-dark-border/40 focus:outline-none ${
                                                                isChecked 
                                                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30' 
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border-transparent bg-transparent'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 truncate text-left">
                                                                {colleague.profile_image_url ? (
                                                                    <img src={colleague.profile_image_url} alt={colleague.user_name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                                        {getInitials(colleague.user_name)}
                                                                    </div>
                                                                )}
                                                                <div className="truncate">
                                                                    <div className="font-bold text-xs text-slate-700 dark:text-github-dark-text truncate">{colleague.user_name}</div>
                                                                    <div className="text-[9px] text-slate-400 truncate">{colleague.dept_name || 'Staff'}</div>
                                                                </div>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked}
                                                                readOnly
                                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 mr-2"
                                                            />
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-100 dark:border-github-dark-border bg-slate-50 dark:bg-github-dark-subtle/30 flex items-center justify-end gap-3 shrink-0">
                                    <button 
                                        onClick={() => setShowGroupModal(false)}
                                        className="px-4 py-2 border border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer bg-white dark:bg-[#0d1117]"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleCreateGroup}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer border-none"
                                    >
                                        Create Group
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </DashboardLayout>
    );
};

export default ChatPage;
