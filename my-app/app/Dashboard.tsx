// C:\Users\shyam\OneDrive\Desktop\t\my-app\app\Dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, SafeAreaView, StyleSheet, ScrollView, Dimensions } from 'react-native'; // Added Dimensions
import { useDispatch, useSelector } from 'react-redux';
import { router } from 'expo-router';
import { listSessions, deleteSession as apiDeleteSession } from '../services/api'; // Adjust path
import { logoutUser, selectUser } from '../features/auth/authSlice'; // Adjust path
import Chat from '../components/Chat'; // We'll create this component next
import { AppDispatch, RootState } from '../store'; // Adjust path
import { Ionicons } from '@expo/vector-icons'; // For icons

interface Session {
  _id: string;
  topic?: string;
  startTime: string; // Assuming ISO string date
}

interface DashboardProps {}

const { width } = Dimensions.get('window'); // Get screen width

export default function Dashboard(props: DashboardProps) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUser);

  const [latestAiResponse, setLatestAiResponse] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      const res = await listSessions();
      setSessions(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setSessionError('Could not load past sessions.');
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNewAiResponse = (responseText: string) => {
    setLatestAiResponse(responseText);
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", onPress: () => dispatch(logoutUser()) }
      ]
    );
  };

  const handleDeleteSession = async (sessionIdToDelete: string) => {
    Alert.alert(
      "Delete Session",
      "Are you sure you want to delete this chat history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiDeleteSession(sessionIdToDelete);
              setSessions(prevSessions => prevSessions.filter(session => session._id !== sessionIdToDelete));
              if (selectedSessionId === sessionIdToDelete) {
                setSelectedSessionId(null);
                setLatestAiResponse('');
              }
              console.log(`Session ${sessionIdToDelete} deleted.`);
            } catch (err) {
              console.error(`Failed to delete session ${sessionIdToDelete}:`, err);
              setSessionError('Could not delete session.');
              Alert.alert("Error", "Could not delete session.");
            }
          }
        }
      ]
    );
  };

  const startNewChat = () => {
    setSelectedSessionId(null);
    setLatestAiResponse('');
    setIsHistoryVisible(false); // Hide history when starting new chat
  };

  // Enhanced Session Item Rendering
  const renderSessionItem = ({ item }: { item: Session }) => {
    const isSelected = selectedSessionId === item._id;
    return (
      <View className={`flex-row items-center justify-between mb-2 rounded-lg p-3 ${isSelected ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
        <TouchableOpacity
          className="flex-1 mr-2" // Take available space, add margin before delete icon
          onPress={() => {
            setSelectedSessionId(item._id);
            setIsHistoryVisible(false); // Hide history after selection
            setLatestAiResponse(''); // Clear previous response
          }}
          activeOpacity={0.7} // Add visual feedback on press
        >
          <Text className={`text-base font-medium ${isSelected ? 'text-white' : 'text-gray-100'} truncate`} numberOfLines={1}>
            {item.topic || 'Untitled Session'}
          </Text>
          <Text className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
            {new Date(item.startTime).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteSession(item._id)}
          className="p-1" // Slightly smaller touch target for icon
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
        >
          <Ionicons name="trash-outline" size={20} color={isSelected ? '#FFFFFF' : '#EF4444'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsHistoryVisible(!isHistoryVisible)} style={styles.iconButton}>
          <Ionicons name={isHistoryVisible ? "close-outline" : "menu-outline"} size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Co-Pilot</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
          <Ionicons name="log-out-outline" size={26} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Main Content Area (Chat) - Always present but might be visually hidden */}
        <View style={[styles.mainContent, isHistoryVisible && styles.hidden]}>
          {/* Chat Component takes most space */}
          <View style={styles.chatArea}>
            <Chat
              key={selectedSessionId || 'new'}
              user={user}
              onNewAiResponse={handleNewAiResponse}
              initialSessionId={selectedSessionId}
            />
          </View>

          {/* Latest Response Area - Consider if needed on mobile or integrate differently */}
          {/* Hiding this for now on mobile for simplicity, can be added back if needed */}
          {/*
          <View style={styles.latestResponseArea}>
            <Text style={styles.latestResponseTitle}>Latest AI Response</Text>
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.latestResponseText}>
                {latestAiResponse || <Text style={styles.italicText}>No response yet.</Text>}
              </Text>
            </ScrollView>
          </View>
          */}
        </View>

        {/* History Sidebar (Conditional & Absolute Positioned) */}
        {isHistoryVisible && (
          <View style={styles.historySidebar}>
            <TouchableOpacity
              onPress={startNewChat}
              style={styles.newChatButton}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={22} color="white" style={{ marginRight: 8 }}/>
              <Text style={styles.newChatButtonText}>New Chat</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>Past Sessions</Text>
            {loadingSessions && <ActivityIndicator color="#ffffff" style={{ marginVertical: 20 }} size="large" />}
            {sessionError && <Text style={styles.errorText}>{sessionError}</Text>}
            {!loadingSessions && sessions.length === 0 && !sessionError && (
              <Text style={styles.emptyListText}>No past sessions found.</Text>
            )}
            <FlatList
              data={sessions}
              renderItem={renderSessionItem}
              keyExtractor={(item) => item._id}
              style={{ flex: 1 }} // Ensure FlatList takes available space
              contentContainerStyle={{ paddingBottom: 20 }} // Add padding at the bottom
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Using StyleSheet for better organization and potential performance benefits
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // bg-gray-900
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1F2937', // bg-gray-800
    borderBottomWidth: 1,
    borderBottomColor: '#374151', // border-gray-700
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  iconButton: {
    padding: 8, // Increase touch area
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row', // Keep row direction for potential future desktop/tablet layout
    position: 'relative', // Needed for absolute positioning of sidebar
  },
  mainContent: {
    flex: 1,
    // backgroundColor: '#111827', // bg-gray-900 (already set on container)
  },
  hidden: {
    display: 'none', // Hide main content when history is visible on mobile
  },
  chatArea: {
    flex: 1, // Takes full height of mainContent now
    backgroundColor: '#111827', // bg-gray-900
  },
  // Styles for the absolutely positioned history sidebar
  historySidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: width * 0.85, // Take 85% of screen width
    maxWidth: 320, // Max width for larger screens
    backgroundColor: '#1F2937', // bg-gray-800
    padding: 15,
    borderRightWidth: 1,
    borderRightColor: '#374151', // border-gray-700
    zIndex: 10, // Ensure it's above main content
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#2563EB', // bg-blue-600
    borderRadius: 8,
  },
  newChatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600', // font-semibold
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600', // font-semibold
    marginBottom: 12,
    color: '#D1D5DB', // text-gray-300
  },
  errorText: {
    color: '#F87171', // text-red-400
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyListText: {
    color: '#6B7280', // text-gray-500
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  // Latest Response Area (Optional - kept styles if needed later)
  latestResponseArea: {
    flex: 1, // Adjust flex ratio if re-enabled
    backgroundColor: '#1F2937', // bg-gray-800
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151', // border-gray-700
    // display: 'none', // Initially hidden on mobile
    // '@md': { display: 'flex' } // Show on medium screens (Tailwind concept)
  },
  latestResponseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: 'white',
  },
  latestResponseText: {
    color: '#E5E7EB', // text-gray-200
    fontSize: 14,
  },
  italicText: {
    fontStyle: 'italic',
    color: '#9CA3AF', // text-gray-400
  },
});
