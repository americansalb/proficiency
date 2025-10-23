// Recording Management
class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.audioRecorder = null;
        this.recordedChunks = [];
        this.audioChunks = [];
        this.stream = null;
        this.audioStream = null;
        this.isRecording = false;
        this.participantName = '';
        this.passcode = '';
    }

    async requestPermissions() {
        try {
            // Request camera and microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },  // Lower resolution
                    height: { ideal: 480 }
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
        this.audioChunks = [];

        try {
            // VIDEO + AUDIO recording (heavily compressed)
            const videoOptions = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 250000,  // 250 kbps - very low quality video
                audioBitsPerSecond: 128000   // 128 kbps - good audio
            };

            if (!MediaRecorder.isTypeSupported(videoOptions.mimeType)) {
                videoOptions.mimeType = 'video/webm';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, videoOptions);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // AUDIO-ONLY recording (separate, for backup)
            const audioTrack = this.stream.getAudioTracks()[0];
            this.audioStream = new MediaStream([audioTrack]);
            
            const audioOptions = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            this.audioRecorder = new MediaRecorder(this.audioStream, audioOptions);

            this.audioRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            // Start both recordings
            this.mediaRecorder.start(1000);
            this.audioRecorder.start(1000);
            this.isRecording = true;

            // Show recording indicator
            document.getElementById('recordingIndicator').classList.add('active');

            console.log('Recording started (video + separate audio)');
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

            let videoStopped = false;
            let audioStopped = false;

            const checkBothStopped = () => {
                if (videoStopped && audioStopped) {
                    this.isRecording = false;
                    
                    // Hide recording indicator
                    document.getElementById('recordingIndicator').classList.remove('active');

                    // Create video blob
                    const videoBlob = new Blob(this.recordedChunks, {
                        type: 'video/webm'
                    });

                    // Create audio blob
                    const audioBlob = new Blob(this.audioChunks, {
                        type: 'audio/webm'
                    });

                    console.log('Recording stopped');
                    console.log('Video blob size:', videoBlob.size);
                    console.log('Audio blob size:', audioBlob.size);

                    // Stop all tracks
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                    }

                    resolve({ videoBlob, audioBlob });
                }
            };

            this.mediaRecorder.onstop = () => {
                videoStopped = true;
                checkBothStopped();
            };

            this.audioRecorder.onstop = () => {
                audioStopped = true;
                checkBothStopped();
            };

            this.mediaRecorder.stop();
            this.audioRecorder.stop();
        });
    }

    async uploadRecording(videoBlob, audioBlob) {
        const timestamp = new Date().toISOString();
        const baseFilename = `${this.passcode}_${this.participantName.replace(/\s+/g, '_')}_${timestamp}`;

        try {
            // Upload AUDIO first (small, reliable)
            console.log('Uploading audio...');
            const audioFormData = new FormData();
            audioFormData.append('video', audioBlob, `${baseFilename}_AUDIO.webm`);
            audioFormData.append('participantName', this.participantName);
            audioFormData.append('passcode', this.passcode);
            audioFormData.append('timestamp', timestamp);
            audioFormData.append('type', 'audio');

            const audioResponse = await fetch('/api/upload', {
                method: 'POST',
                body: audioFormData
            });

            if (!audioResponse.ok) {
                throw new Error(`Audio upload failed: ${audioResponse.statusText}`);
            }

            const audioResult = await audioResponse.json();
            console.log('Audio uploaded successfully:', audioResult);

            // Upload VIDEO (larger, might fail)
            console.log('Uploading video...');
            const videoFormData = new FormData();
            videoFormData.append('video', videoBlob, `${baseFilename}_VIDEO.webm`);
            videoFormData.append('participantName', this.participantName);
            videoFormData.append('passcode', this.passcode);
            videoFormData.append('timestamp', timestamp);
            videoFormData.append('type', 'video');

            const videoResponse = await fetch('/api/upload', {
                method: 'POST',
                body: videoFormData
            });

            if (!videoResponse.ok) {
                console.warn('Video upload failed, but audio succeeded');
                return {
                    success: true,
                    audioOnly: true,
                    audio: audioResult,
                    videoError: videoResponse.statusText
                };
            }

            const videoResult = await videoResponse.json();
            console.log('Video uploaded successfully:', videoResult);

            return {
                success: true,
                audio: audioResult,
                video: videoResult
            };

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
}

// Global recording manager instance
window.recordingManager = new RecordingManager();
