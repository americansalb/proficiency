// Recording Management
class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.participantName = '';
        this.passcode = '';
    }

    async requestPermissions() {
        try {
            // Request camera and microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            
            console.log('Camera and microphone access granted');
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Unable to access camera/microphone. Please grant permissions and try again.');
            return false;
        }
    }

    startRecording(participantName, passcode) {
        if (!this.stream) {
            console.error('No media stream available');
            return false;
        }

        this.participantName = participantName;
        this.passcode = passcode;
        this.recordedChunks = [];

        try {
            // Use webm format with VP9 codec for better compression
            const options = {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
            };

            // Fallback to VP8 if VP9 not supported
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp8,opus';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped, chunks:', this.recordedChunks.length);
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
            };

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;

            // Show recording indicator
            document.getElementById('recordingIndicator').classList.add('active');

            console.log('Recording started');
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('No active recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                
                // Hide recording indicator
                document.getElementById('recordingIndicator').classList.remove('active');

                // Create blob from recorded chunks
                const blob = new Blob(this.recordedChunks, {
                    type: 'video/webm'
                });

                console.log('Recording stopped, blob size:', blob.size);

                // Stop all tracks
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                }

                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    async uploadRecording(blob) {
        const formData = new FormData();
        const timestamp = new Date().toISOString();
        const filename = `${this.passcode}_${this.participantName.replace(/\s+/g, '_')}_${timestamp}.webm`;

        formData.append('video', blob, filename);
        formData.append('participantName', this.participantName);
        formData.append('passcode', this.passcode);
        formData.append('timestamp', timestamp);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);
            return result;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
}

// Global recording manager instance
window.recordingManager = new RecordingManager();
