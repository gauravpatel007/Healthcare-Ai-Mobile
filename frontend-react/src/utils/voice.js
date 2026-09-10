import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export const startSpeechRecognition = async ({
  onResult,
  onEnd,
  onError,
  language = 'en-US'
}) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { SpeechRecognition } = Capacitor.Plugins;
      if (!SpeechRecognition) {
        throw new Error('SpeechRecognition plugin not found');
      }

      // Check permissions
      let { speechRecognition } = await SpeechRecognition.checkPermissions();
      if (speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== 'granted') {
          toast.error("Microphone permission denied.");
          if (onError) onError();
          return null;
        }
      }

      // We use a simpler popup mode for native by default, or non-popup.
      // Usually, the community plugin partialResults listener works like this:
      const listener = await SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length > 0) {
          onResult(data.matches[0]);
        }
      });

      // Some Android/iOS engines don't fire partialResults reliably,
      // so we also need to capture the final result returned by start().
      SpeechRecognition.start({
        language,
        maxResults: 1,
        prompt: "Listening...",
        partialResults: true,
        popup: false
      }).then((result) => {
         if (result && result.matches && result.matches.length > 0) {
           onResult(result.matches[0]);
         }
         // Call onEnd automatically when native engine naturally stops
         if (onEnd) onEnd();
      }).catch(err => {
         console.error("Speech start error:", err);
      });

      return {
        stop: async () => {
          try {
            await SpeechRecognition.stop();
          } catch(e) {}
          if (listener) listener.remove();
          if (onEnd) onEnd();
        }
      };

    } catch (error) {
      console.error("Native speech recognition error:", error);
      toast.error("Microphone not available natively.");
      if (onError) onError(error);
      return null;
    }
  } else {
    // Web Speech API Fallback
    const WebSpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!WebSpeechAPI) {
      toast.error("Speech recognition is not supported in this browser.");
      if (onError) onError();
      return null;
    }

    const recognition = new WebSpeechAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      onResult(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Web speech recognition error:", event.error);
      if (onError) onError(event);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    try {
      recognition.start();
      return {
        stop: () => recognition.stop()
      };
    } catch (error) {
      console.error("Error starting web speech:", error);
      if (onError) onError(error);
      return null;
    }
  }
};
