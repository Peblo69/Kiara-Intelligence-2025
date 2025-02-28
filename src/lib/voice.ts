// Voice recognition service for Kiara Vision X
export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private onResultCallback: ((text: string) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private isAutoRestarting = false;
  private autoRestartTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStartCallback) {
        this.onStartCallback();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEndCallback) {
        // Only trigger end callback if not auto-restarting
        if (!this.isAutoRestarting) {
          this.onEndCallback();
        }
        this.isAutoRestarting = false;
      }
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Only send final transcripts
      if (finalTranscript && this.onResultCallback) {
        this.onResultCallback(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(
          event.error === 'not-allowed' 
            ? 'Please allow microphone access to use voice input.'
            : event.error
        );
      }
    };
  }

  public startListening() {
    if (!this.recognition) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Speech recognition not supported in this browser');
      }
      return;
    }

    if (!this.isListening) {
      try {
        // Clear any existing timeout
        if (this.autoRestartTimeout) {
          clearTimeout(this.autoRestartTimeout);
          this.autoRestartTimeout = null;
        }
        this.recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback('Failed to start voice recognition');
        }
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.isAutoRestarting = false;
        if (this.autoRestartTimeout) {
          clearTimeout(this.autoRestartTimeout);
          this.autoRestartTimeout = null;
        }
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }

  public onResult(callback: (text: string) => void) {
    this.onResultCallback = callback;
  }

  public onStart(callback: () => void) {
    this.onStartCallback = callback;
  }

  public onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  public onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;
  }

  public scheduleAutoRestart(delay: number = 1000) {
    if (this.autoRestartTimeout) {
      clearTimeout(this.autoRestartTimeout);
    }
    this.isAutoRestarting = true;
    this.autoRestartTimeout = setTimeout(() => {
      if (!this.isListening) {
        this.startListening();
      }
    }, delay);
  }
}

// Create a singleton instance
export const voiceService = new VoiceService();