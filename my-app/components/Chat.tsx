import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, StyleSheet, PermissionsAndroid, AppState
} from 'react-native';
import { getSession, startSession, sendMessage, updateSession } from '../services/api'; // Adjust path
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker'; // For model selection
import Voice, { SpeechResultsEvent, SpeechErrorEvent, SpeechStartEvent, SpeechEndEvent, SpeechRecognizedEvent } from '@react-native-voice/voice';
import Constants from 'expo-constants';

// Define message structure
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ChatProps {
  user: any;
  onNewAiResponse: (responseText: string) => void;
  initialSessionId?: string | null;
}

export default function Chat({ user, onNewAiResponse, initialSessionId = null }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Initializing...');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [savedSystemPrompt, setSavedSystemPrompt] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isSystemPromptVisible, setIsSystemPromptVisible] = useState(false);
  // Voice Recognition State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [partialResults, setPartialResults] = useState<string[]>([]);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(false);
  const appState = useRef(AppState.currentState);

  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  const availableModels = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.0-flash-001', name: 'Gemini 2 Flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2 Pro' },
  ];

  // --- Voice Recognition Control Functions (Moved WAY Up) ---
  // Moved here to be defined before the main useEffect that uses stopRecognizing in deps

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Microphone Permission",
            message: "This app needs access to your microphone for voice input.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // Assume granted on iOS as it's handled by Info.plist
  }, []); // No external dependencies

  const startRecognizing = useCallback(async () => {
    // Check conditions first to avoid unnecessary permission requests
    if (loading || !sessionId || !isVoiceAvailable) {
      console.log('Conditions not met for starting recognition:', { loading, sessionId, isVoiceAvailable });
      return;
    }

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Microphone permission is required for voice input.");
      return;
    }

    setPartialResults([]);
    setVoiceError(null);
    setInput(''); // Clear text input when starting voice
    try {
      // Add null check before using Voice
      if (!Voice) {
         console.error("Cannot start recognition: Voice module is null.");
         setVoiceError("Speech recognition native module not found.");
         return;
      }
      await Voice.start('en-US'); // Use appropriate locale
      console.log('Voice recognition started');
      setIsRecording(true); // Explicitly set recording state
    } catch (e) {
      console.error('Error starting voice recognition:', e);
      setVoiceError('Failed to start voice recognition.');
      setIsRecording(false); // Ensure state is correct on error
    }
  // Dependencies: Include state/props read inside the function
  }, [loading, sessionId, isVoiceAvailable, requestMicrophonePermission]);

  const stopRecognizing = useCallback(async () => {
    try {
      // Add null check before using Voice
      if (!Voice) {
         console.error("Cannot stop recognition: Voice module is null.");
         // Optionally set an error state if needed, but usually stopping silently is fine
         setIsRecording(false); // Ensure state is updated regardless
         return;
      }
      // Check if Voice is actually listening before stopping
      const isListening = await Voice.isRecognizing();
      if (isListening) {
        await Voice.stop();
        console.log('Voice recognition stopped');
      } else {
        console.log('Voice recognition stop called, but not currently recognizing.');
      }
      setIsRecording(false); // Ensure state is updated regardless
    } catch (e) {
      console.error('Error stopping voice recognition:', e);
      // Don't set error here usually, as stop might be called programmatically
      setIsRecording(false); // Ensure state is correct on error
    }
  }, []); // No external dependencies needed here

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecognizing();
    } else {
      startRecognizing();
    }
  // Dependencies: Include functions called inside
  }, [isRecording, startRecognizing, stopRecognizing]);


  // --- Session Initialization & Voice Setup Effect ---
  useEffect(() => {
    const initializeSession = async () => {
      setError(null);
      setStatus('Connecting...');
      setMessages([]);
      setSystemPrompt('');
      setSavedSystemPrompt('');

      if (initialSessionId) {
        try {
          setStatus(`Loading session...`);
          setLoading(true);
          const res = await getSession(initialSessionId);
          const sessionData = res.data;
          setMessages(sessionData.messages || []);
          setSessionId(sessionData._id);
          const loadedPrompt = sessionData.systemPrompt || '';
          setSystemPrompt(loadedPrompt);
          setSavedSystemPrompt(loadedPrompt);
          setStatus('Session loaded');
        } catch (err: any) {
          console.error(`Failed to load session ${initialSessionId}:`, err);
          setError(`Failed to load session. ${err.message || 'Unknown error'}`);
          setStatus('Session load failed');
          setSessionId(null);
        } finally {
          setLoading(false);
        }
      } else {
        try {
          setStatus('Creating new session...');
          setLoading(true);
          const res = await startSession({ systemPrompt: '' });
          setSessionId(res.data.sessionId);
          setSavedSystemPrompt('');
          setMessages([]);
          setStatus('New session active');
        } catch (err: any) {
          console.error('New session creation failed:', err);
          setError('Failed to create session. Please try again.');
          setStatus('Session creation failed');
        } finally {
          setLoading(false);
        }
      }
    };

    initializeSession();

    // --- Voice Initialization ---
    const checkVoiceAvailability = async () => {
      // Add null check for Voice module
      if (!Voice) {
        console.error("Voice module is not available. Native linking might be missing.");
        setVoiceError("Speech recognition native module not found.");
        setIsVoiceAvailable(false);
        return;
      }
      try {
        const available = await Voice.isAvailable();
        setIsVoiceAvailable(!!available); // Explicitly cast to boolean
        if (!available) {
          setVoiceError("Speech recognition is not available on this device.");
        }
      } catch (e) {
        console.error("Error checking voice availability:", e);
        setVoiceError("Could not check speech recognition availability.");
        setIsVoiceAvailable(false);
      }
    };
    checkVoiceAvailability();

    // --- App State Listener for Voice Cleanup ---
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Re-check or re-initialize voice if needed
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('App has gone to the background!');
        // Stop recording if active when app goes to background
        if (isRecording) {
          stopRecognizing();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      // Ensure voice resources are cleaned up on unmount
      if (Voice) { // Add null check
        Voice.destroy().then(Voice.removeAllListeners).catch(e => console.error("Error destroying voice:", e));
      }
    };
  // Add stopRecognizing to dependency array for handleAppStateChange cleanup logic
  // Note: stopRecognizing is stable due to useCallback, but adding it explicitly satisfies some linters/hooks rules
  // Now stopRecognizing is defined above, so this dependency is valid.
  }, [initialSessionId, stopRecognizing]);

  // --- Scroll to bottom ---
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100); // Add slight delay
    }
  }, [messages]);

  // --- Send Message Logic ---
  const sendTextToServer = async (textToSend: string) => {
    if (!textToSend || loading || !sessionId) return;

    setLoading(true);
    setError(null);
    setInput('');

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const res = await sendMessage({
        sessionId: sessionId,
        text: textToSend,
        model: selectedModel
      });

      const aiMessage: Message = {
        role: 'assistant',
        content: res.data.response,
        timestamp: res.data.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);

      if (onNewAiResponse) {
        onNewAiResponse(aiMessage.content);
      }

    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to get response from AI';
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const textToSend = input.trim();
    if (textToSend) {
      sendTextToServer(textToSend);
    }
  };


  // --- Voice Recognition Handlers --- (Control functions moved above main useEffect)
  const onSpeechStart = useCallback((e: SpeechStartEvent) => {
    console.log('onSpeechStart: ', e);
    setIsRecording(true);
    setVoiceError(null);
    setPartialResults([]);
  }, []);

  const onSpeechEnd = useCallback((e: SpeechEndEvent) => {
    console.log('onSpeechEnd: ', e);
    setIsRecording(false);
    // Optionally automatically restart listening here if desired for continuous mode
    startRecognizing(); // Uncommented for continuous listening attempt
  }, [startRecognizing]); // Add startRecognizing as a dependency

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.error('onSpeechError: ', e);
    let errorMessage = e.error?.message || 'Unknown speech error';
    // Customize error messages based on codes if needed
    if (e.error?.code === '7') errorMessage = 'No speech detected. Please try speaking again.';
    if (e.error?.code === '6') errorMessage = 'Listening timed out. Tap the mic to try again.';
    setVoiceError(errorMessage);
    setIsRecording(false);
  }, []);

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    console.log('onSpeechResults: ', e);
    if (e.value && e.value.length > 0) {
      const spokenText = e.value[0];
      // Send the final recognized text
      sendTextToServer(spokenText);
      setPartialResults([]); // Clear partial results
    }
    // Stop recognition explicitly after getting final results if not continuous
    // stopRecognizing(); // Keep commented if onSpeechEnd handles stopping or restarting
  }, [sendTextToServer]); // Removed stopRecognizing dep as it's stable via useCallback above

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    console.log('onSpeechPartialResults: ', e);
    if (e.value) {
      setPartialResults(e.value);
      // Update the text input with the latest partial result for feedback
      if (e.value.length > 0) {
        setInput(e.value[0]);
      }
    }
  }, []);

  // --- Effect to Register Voice Listeners ---
  useEffect(() => {
    // Add null check for Voice module
    if (!Voice) {
      console.error("Cannot register voice listeners: Voice module is null.");
      return; // Exit if Voice module isn't linked/available
    }
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;

    return () => {
      // Clean up listeners
      if (Voice) { // Add null check
        Voice.destroy().then(Voice.removeAllListeners).catch(e => console.error("Error destroying voice on cleanup:", e));
      }
    };
  }, [onSpeechStart, onSpeechEnd, onSpeechError, onSpeechResults, onSpeechPartialResults]); // Dependencies are correct here


  // --- System Prompt Logic --- (Control functions were moved above handlers)
  const saveSystemPrompt = async () => {
    if (!sessionId || systemPrompt === savedSystemPrompt || isSavingPrompt) return;

    setIsSavingPrompt(true);
    setError(null);

    try {
      const res = await updateSession(sessionId, { systemPrompt });
      setSavedSystemPrompt(res.data.session.systemPrompt);
      console.log('System prompt updated successfully');
      Alert.alert("Success", "System prompt saved.");
    } catch (err: any) {
      console.error('Failed to save system prompt:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to save prompt';
      setError(`Error saving prompt: ${errorMessage}`);
      Alert.alert("Error", `Failed to save prompt: ${errorMessage}`);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  // --- Render Message Item ---
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.aiMessageRow]}>
        {/* AI Avatar */}
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
        )}

        {/* Message Bubble */}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={styles.messageText}>{item.content || ''}</Text>
          {/* Timestamp */}
          {item.timestamp && (
            <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* User Avatar */}
        {isUser && (
          <View style={[styles.avatarContainer, styles.userAvatar]}>
            <Text style={styles.avatarText}>You</Text>
          </View>
        )}
      </View>
    );
  };

  // --- Main Render ---
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingContainer}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} // Increased iOS offset slightly
    >
      <View style={styles.chatContainer}>
        {/* Header Area */}
        <View style={styles.headerContainer}>
          {/* Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, sessionId ? styles.statusOnline : styles.statusOffline]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
          {/* Model Selector */}
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedModel}
              onValueChange={(itemValue: string) => setSelectedModel(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem} // Style for items in dropdown
              dropdownIconColor="#D1D5DB" // White icon
              enabled={!loading}
              mode="dropdown" // Use dropdown mode
            >
              {availableModels.map(model => (
                <Picker.Item key={model.id} label={model.name} value={model.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* System Prompt Section */}
        <View style={styles.systemPromptSection}>
          <TouchableOpacity
            onPress={() => setIsSystemPromptVisible(!isSystemPromptVisible)}
            style={styles.systemPromptToggle}
          >
            <Text style={styles.systemPromptLabel}>System Prompt</Text>
            <Ionicons name={isSystemPromptVisible ? "chevron-up-outline" : "chevron-down-outline"} size={18} color="#D1D5DB" />
          </TouchableOpacity>
          {isSystemPromptVisible && (
            <View style={styles.systemPromptInputContainer}>
              <TextInput
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="Define AI behavior (e.g., Act as a helpful assistant)"
                placeholderTextColor="#9CA3AF"
                multiline
                style={styles.systemPromptInput}
                editable={!loading && !isSavingPrompt && !!sessionId}
              />
              {sessionId && (
                <TouchableOpacity
                  onPress={saveSystemPrompt}
                  disabled={isSavingPrompt || systemPrompt === savedSystemPrompt || loading}
                  style={[styles.savePromptButton, (isSavingPrompt || systemPrompt === savedSystemPrompt || loading) && styles.savePromptButtonDisabled]}
                >
                  <Text style={styles.savePromptButtonText}>
                    {isSavingPrompt ? 'Saving...' : 'Save Prompt'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Messages Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item, index) => `${item.role}-${index}-${item.timestamp || index}`}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          ListEmptyComponent={
            !loading && !sessionId ? (
              <View style={styles.emptyListContainer}>
                <ActivityIndicator size="small" color="#9CA3AF" />
                <Text style={styles.emptyListText}>Initializing chat...</Text>
              </View>
            ) : !loading && messages.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color="#6B7280" />
                <Text style={styles.emptyListText}>Send a message to start the conversation.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={loading && messages.length > 0 ? (
            <View style={[styles.messageRow, styles.aiMessageRow]}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>AI</Text>
              </View>
              <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color="#E5E7EB" />
              </View>
            </View>
            ) : null}
        />

        {/* Voice Error Display */}
        {voiceError && (
          <View style={styles.voiceErrorContainer}>
            <Text style={styles.voiceErrorText}>{voiceError}</Text>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputAreaContainer}>
          {/* Microphone Button */}
          <TouchableOpacity
            onPress={toggleRecording}
            disabled={loading || !sessionId || !isVoiceAvailable}
            style={[styles.micButton, (!sessionId || !isVoiceAvailable) && styles.micButtonDisabled]}
          >
            <Ionicons
              name={isRecording ? "mic-off-outline" : "mic-outline"}
              size={24}
              color={isRecording ? "#F87171" : (isVoiceAvailable ? "white" : "#6B7280")} // Red when recording, white when available, gray otherwise
            />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={sessionId ? "Type your message..." : "Connecting..."}
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.textInput}
            editable={!loading && !!sessionId && !isRecording} // Disable input while recording
          />
          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading || !sessionId || !input.trim() || isRecording} // Disable send while recording
            style={[styles.sendButton, (loading || !sessionId || !input.trim() || isRecording) && styles.sendButtonDisabled]}
          >
            {loading && !isRecording ? ( // Show loader only if sending text, not during recording
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={22} color="white" style={styles.sendIcon} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- StyleSheet ---
const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
    backgroundColor: '#111827', // bg-gray-900
  },
  chatContainer: {
    flex: 1,
    padding: 5,
    backgroundColor: '#111827', // bg-gray-900
  },
  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    flexWrap: 'wrap', // Allow wrapping on smaller screens if needed
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 0, // Add some space
    marginBottom: 5, // Spacing for wrap
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusOnline: {
    backgroundColor: '#10B981', // bg-green-500
  },
  statusOffline: {
    backgroundColor: '#EF4444', // bg-red-500
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF', // text-gray-400
  },
  pickerContainer: {
    backgroundColor: '#374151', // bg-gray-700
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4B5563', // border-gray-600
    // overflow: 'hidden', // Ensure border radius clips picker
    minWidth: '60%', // Ensure picker has some minimum width
    maxWidth: '70%', // Prevent it from getting too wide on larger screens within header
    marginBottom: 5, // Spacing for wrap
    height: 35, // Increased height slightly for the container
    justifyContent: 'center', // Center the picker vertically
  },
  picker: {
    // height: Platform.OS === 'ios' ? undefined : 40, // Removed explicit Android height
    width: '100%', // Take full width of container
    color: '#FFFFFF', // Explicitly set selected item text color to white
    backgroundColor: 'transparent',
  },
  pickerItem: {
    // Style items within the dropdown (limited styling possible)
    fontSize: 10,
  
    color: Platform.OS === 'ios' ? 'white' : 'black', // Keep default black for Android dropdown items
  },
  // System Prompt Styles
  systemPromptSection: {
    marginBottom: 0,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingHorizontal:10,
    paddingTop:5,
  },
  systemPromptToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  systemPromptLabel: {
    fontSize: 15,
    fontWeight: '500', 
    color: '#D1D5DB', 
  },
  systemPromptInputContainer: {
    // Container for input and button
  },
  systemPromptInput: {
    minHeight: 60,
    maxHeight: 120, // Limit expansion
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#374151', // bg-gray-700
    color: 'white',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#4B5563', // border-gray-600
    textAlignVertical: 'top', // Align text to top for multiline
  },
  savePromptButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#16A34A', // bg-green-600
    alignSelf: 'flex-start', // Align button to the left
  },
  savePromptButtonDisabled: {
    backgroundColor: '#6B7280', // bg-gray-500
  },
  savePromptButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600', // semibold
  },
  // Error Styles
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // bg-red-900/50 with alpha
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  errorText: {
    color: '#FCA5A5', // text-red-300 slightly lighter red
    fontSize: 13,
    textAlign: 'center',
  },
  // Message List Styles
  messageList: {
    flex: 1, // Take available space
    marginBottom: 8,
  },
  messageListContent: {
    paddingVertical: 10, // Add padding inside the scrollable area
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListText: {
    color: '#6B7280', // text-gray-500
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  // Message Item Styles
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align items to the bottom
    marginVertical: 6, // Vertical spacing between messages
  },
  userMessageRow: {
    justifyContent: 'flex-end', // Align user messages to the right
  },
  aiMessageRow: {
    justifyContent: 'flex-start', // Align AI messages to the left
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8, // Space between avatar and bubble
    backgroundColor: '#F97316', // bg-orange-500 for AI
  },
  userAvatar: {
    backgroundColor: '#9333EA', // bg-purple-600 for User
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  messageBubble: {
    maxWidth: '75%', // Max width of bubble
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18, // More rounded bubbles
  },
  userBubble: {
    backgroundColor: '#2563EB', // bg-blue-600
    borderBottomRightRadius: 4, // Slightly flatten corner near avatar
  },
  aiBubble: {
    backgroundColor: '#4B5563', // bg-gray-600 (slightly darker than picker)
    borderBottomLeftRadius: 4, // Slightly flatten corner near avatar
  },
  messageText: {
    color: 'white',
    fontSize: 15, // Slightly larger text
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF', // text-gray-400
    marginTop: 4,
    alignSelf: 'flex-end', // Align timestamp to the right within the bubble
  },
  userTimestamp: {
    color: '#DBEAFE', // text-blue-100
  },
  aiTimestamp: {
    color: '#D1D5DB', // text-gray-300
  },
  thinkingBubble: {
    paddingVertical: 12, // Adjust padding for indicator
    paddingHorizontal: 16,
  },
  // Input Area Styles
  inputAreaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 6 : 3,
  },
  textInput: {
    flex: 1,
    minHeight: 44, // Good minimum touch height
    maxHeight: 120, // Limit height expansion
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 22, // Pill shape
    backgroundColor: '#374151', // bg-gray-700
    color: 'white',
    fontSize: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4B5563', // border-gray-600
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22, // Circular button
    backgroundColor: '#2563EB', // bg-blue-600
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#60A5FA', // bg-blue-400
  },
  sendIcon: {
    marginLeft: 2, // Nudge icon slightly for visual centering
  },
  // Voice Error Styles
  voiceErrorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Lighter red background
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginHorizontal: 10, // Align with input area roughly
    marginBottom: 5, // Space above input area
  },
  voiceErrorText: {
    color: '#FCA5A5', // text-red-300
    fontSize: 12,
    textAlign: 'center',
  },
  // Microphone Button Styles
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4B5563', // bg-gray-600
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Space between mic and input
  },
  micButtonDisabled: {
    backgroundColor: '#374151', // bg-gray-700 (darker disabled)
  },
});
