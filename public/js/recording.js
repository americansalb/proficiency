// Recording Management - Per Question Recording
class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.participantInfo = null;
        this.currentQuestion = 0;
    }

    async requestPermissions() {
        try {
            // Request camera and microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320 },  // Very low resolution
                    height: { ideal: 240 }
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

    setParticipantInfo(firstName, lastName, passcode) {
        this.participantInfo = {
            firstName: firstName,
            lastName: lastName,
            fullName: `${firstName} ${lastName}`,
            passcode: passcode
        };
    }

    startQuestionRecording(questionNumber) {
        if (!this.stream) {
            console.error('No media stream available');
            return false;
        }

        this.currentQuestion = questionNumber;
        this.recordedChunks = [];

        try {
            // ULTRA COMPRESSED VIDEO (potato quality for fast upload)
            const videoOptions = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 100000,  // 100 kbps - potato quality
                audioBitsPerSecond: 96000    // 96 kbps - decent audio
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

            // Start recording
            this.mediaRecorder.start(1000);
            this.isRecording = true;

            // Show recording indicator
            document.getElementById('recordingIndicator').classList.add('active');

            console.log(`Question ${questionNumber} recording started`);
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    stopQuestionRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('No active recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                
                // Create blob from recorded chunks
                const blob = new Blob(this.recordedChunks, {
                    type: 'video/webm'
                });

                console.log(`Question ${this.currentQuestion} recording stopped, blob size:`, blob.size);

                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    async uploadQuestionRecording(blob) {
        const timestamp = new Date().toISOString();
        const filename = `Question_${this.currentQuestion}_${timestamp}.webm`;

        const formData = new FormData();
        formData.append('video', blob, filename);
        formData.append('firstName', this.participantInfo.firstName);
        formData.append('lastName', this.participantInfo.lastName);
        formData.append('passcode', this.participantInfo.passcode);
        formData.append('questionNumber', this.currentQuestion);
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
            console.log(`Question ${this.currentQuestion} uploaded:`, result);
            return result;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    stopAllRecording() {
        // Hide recording indicator
        document.getElementById('recordingIndicator').classList.remove('active');
        
        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// Global recording manager instance
window.recordingManager = new RecordingManager();
