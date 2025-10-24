// Recording Management - Per Question with Non-Blocking Uploads + Continuous Anti-Cheat Recording
class RecordingManager {
    constructor() {
        // Per-question recording (user-controlled)
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.participantInfo = null;
        this.currentQuestion = 0;
        this.pendingUploads = []; // Track uploads in progress

        // Continuous full-session recording (anti-cheat, background)
        this.continuousRecorder = null;
        this.continuousChunks = [];
        this.continuousStream = null; // Cloned stream for continuous recording
        this.isContinuousRecording = false;
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

        // SAFEGUARD: Don't restart recording if we're already recording this question
        // This prevents the recording from restarting when user replays the media
        if (this.isRecording && this.currentQuestion === questionNumber) {
            console.log(`Already recording Question ${questionNumber}, continuing...`);
            return true;
        }

        // If we're recording a different question, stop it first
        if (this.isRecording && this.currentQuestion !== questionNumber) {
            console.warn(`Switching from Question ${this.currentQuestion} to ${questionNumber}`);
        }

        this.currentQuestion = questionNumber;
        this.recordedChunks = [];

        try {
            // Low quality video, high quality audio for transcription
            const videoOptions = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 100000,  // 100 kbps - potato quality video
                audioBitsPerSecond: 192000   // 192 kbps - high quality audio for AI transcription
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

            // Show recording indicator (if it exists)
            const indicator = document.getElementById('recordingIndicator');
            if (indicator) {
                indicator.classList.add('active');
            }

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
                // If recording already stopped but we have chunks, return them
                if (this.recordedChunks.length > 0) {
                    const blob = new Blob(this.recordedChunks, {
                        type: 'video/webm'
                    });
                    console.log(`Recording already stopped, returning existing blob size:`, blob.size);
                    resolve(blob);
                } else {
                    reject(new Error('No active recording'));
                }
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

    async uploadQuestionRecording(blob, questionNumber) {
        const timestamp = new Date().toISOString();
        const testType = window.testCredentials?.testType || 'ENGLISH';
        const filename = `Question_${questionNumber}_${timestamp}.webm`;

        const formData = new FormData();
        formData.append('video', blob, filename);
        formData.append('firstName', this.participantInfo.firstName);
        formData.append('lastName', this.participantInfo.lastName);
        formData.append('passcode', this.participantInfo.passcode);
        formData.append('questionNumber', questionNumber);
        formData.append('timestamp', timestamp);
        formData.append('testType', testType);

        const uploadPromise = fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            console.log(`Question ${questionNumber} uploaded successfully:`, result);
            return result;
        })
        .catch(error => {
            console.error(`Question ${questionNumber} upload error:`, error);
            throw error;
        });

        // Track this upload
        this.pendingUploads.push(uploadPromise);

        return uploadPromise;
    }

    async waitForAllUploads() {
        console.log(`Waiting for ${this.pendingUploads.length} uploads to complete...`);

        if (this.pendingUploads.length === 0) {
            return;
        }

        try {
            await Promise.all(this.pendingUploads);
            console.log('All uploads completed successfully');
        } catch (error) {
            console.error('Some uploads failed:', error);
            throw error;
        }
    }

    stopAllRecording() {
        // Hide recording indicator (if it exists)
        const indicator = document.getElementById('recordingIndicator');
        if (indicator) {
            indicator.classList.remove('active');
        }

        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // CONTINUOUS RECORDING (Anti-Cheat) - Runs entire test session
    startContinuousRecording() {
        if (!this.stream) {
            console.error('No media stream available for continuous recording');
            return false;
        }

        if (this.isContinuousRecording) {
            console.log('Continuous recording already in progress');
            return true;
        }

        try {
            // CRITICAL: Clone the stream so we can have two separate MediaRecorders
            // One for per-question (user-controlled) and one for continuous (background)
            this.continuousStream = this.stream.clone();

            // Lower quality for continuous recording to save bandwidth
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 80000,   // 80 kbps - very low video quality
                audioBitsPerSecond: 96000    // 96 kbps - decent audio
            };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }

            this.continuousRecorder = new MediaRecorder(this.continuousStream, options);
            this.continuousChunks = [];

            this.continuousRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.continuousChunks.push(event.data);
                }
            };

            this.continuousRecorder.start(1000); // Collect data every second
            this.isContinuousRecording = true;

            console.log('Continuous anti-cheat recording started (on cloned stream)');
            return true;
        } catch (error) {
            console.error('Error starting continuous recording:', error);
            return false;
        }
    }

    stopContinuousRecording() {
        return new Promise((resolve, reject) => {
            if (!this.continuousRecorder || !this.isContinuousRecording) {
                console.log('No continuous recording to stop');
                reject(new Error('No active continuous recording'));
                return;
            }

            this.continuousRecorder.onstop = () => {
                this.isContinuousRecording = false;

                const blob = new Blob(this.continuousChunks, {
                    type: 'video/webm'
                });

                console.log('Continuous recording stopped, blob size:', blob.size);
                resolve(blob);
            };

            this.continuousRecorder.stop();
        });
    }

    async uploadContinuousRecording(blob) {
        const timestamp = new Date().toISOString();
        const testType = window.testCredentials?.testType || 'ENGLISH';
        const filename = `FULL_SESSION_${timestamp}.webm`;

        const formData = new FormData();
        formData.append('video', blob, filename);
        formData.append('firstName', this.participantInfo.firstName);
        formData.append('lastName', this.participantInfo.lastName);
        formData.append('passcode', this.participantInfo.passcode);
        formData.append('questionNumber', 'FULL_SESSION');
        formData.append('timestamp', timestamp);
        formData.append('testType', testType);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Continuous recording upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Continuous recording uploaded successfully:', result);
            return result;
        } catch (error) {
            console.error('Continuous recording upload error:', error);
            throw error;
        }
    }
}

// Global recording manager instance
window.recordingManager = new RecordingManager();
