import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export function useLiveSpeech() {
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  function start() {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  }
  function stop() {
    SpeechRecognition.stopListening();
  }
  return { transcript, listening, start, stop };
}
