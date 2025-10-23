// Continuous Recording Manager with Auto-Chunking
class RecordingManager {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.isRecording = false;
        this.participantInfo = null;
        this.chunkNumber = 0;
        this.recordingStartTime = null;
        this.questionBoundaries = []; // Track when each question starts
        this.currentQuestion = 0;
    }

    async requestPermissions() {
        try {
            // Request camera and microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320 },  // Low resolution for smaller file size
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

    startContinuousRecording() {
        if (!this.stream) {
            console.error('No media stream available');
            return false;
        }

        if (this.isRecording) {
            console.log('Recording already in progress');
            return true;
        }

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
            this.recordingStartTime = Date.now();
            this.chunkNumber = 0;
            this.questionBoundaries = [];

            // Auto-chunk every 5 minutes (300000 ms)
            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    this.chunkNumber++;
                    console.log(`Chunk ${this.chunkNumber} ready, size: ${event.data.size} bytes`);

                    // Upload chunk in background (non-blocking)
                    this.uploadChunk(event.data, this.chunkNumber).catch(err => {
                        console.error(`Chunk ${this.chunkNumber} upload failed:`, err);
                    });
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped');
                this.isRecording = false;
            };

            // Start recording with 5-minute chunks
            this.mediaRecorder.start(300000); // 5 minutes = 300000 ms
            this.isRecording = true;

            // Show recording indicator
            document.getElementById('recordingIndicator').classList.add('active');

            console.log('Continuous recording started with 5-minute auto-chunking');
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    markQuestionBoundary(questionNumber) {
        const timestamp = Date.now() - this.recordingStartTime;
        this.currentQuestion = questionNumber;

        this.questionBoundaries.push({
            question: questionNumber,
            timestamp: timestamp,
            timeFormatted: this.formatTime(timestamp)
        });

        console.log(`Question ${questionNumber} started at ${this.formatTime(timestamp)}`);
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async uploadChunk(blob, chunkNum) {
        const timestamp = new Date().toISOString();
        const filename = `Chunk_${chunkNum}_${timestamp}.webm`;

        const formData = new FormData();
        formData.append('video', blob, filename);
        formData.append('firstName', this.participantInfo.firstName);
        formData.append('lastName', this.participantInfo.lastName);
        formData.append('passcode', this.participantInfo.passcode);
        formData.append('chunkNumber', chunkNum);
        formData.append('timestamp', timestamp);
        formData.append('currentQuestion', this.currentQuestion);
        formData.append('questionBoundaries', JSON.stringify(this.questionBoundaries));

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`Chunk ${chunkNum} uploaded successfully:`, result);
            return result;
        } catch (error) {
            console.error(`Chunk ${chunkNum} upload error:`, error);
            throw error;
        }
    }

    async stopAndUploadFinal() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('No active recording'));
                return;
            }

            // Handle the final chunk
            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    this.chunkNumber++;
                    console.log(`Final chunk ${this.chunkNumber} ready, size: ${event.data.size} bytes`);

                    try {
                        await this.uploadChunk(event.data, this.chunkNumber);
                        console.log('Final chunk uploaded successfully');
                        resolve();
                    } catch (error) {
                        console.error('Final chunk upload failed:', error);
                        reject(error);
                    }
                } else {
                    resolve(); // No final data to upload
                }
            };

            // Stop recording - this will trigger ondataavailable with final chunk
            this.mediaRecorder.stop();
        });
    }

    stopAllRecording() {
        // Hide recording indicator
        document.getElementById('recordingIndicator').classList.remove('active');

        // Stop media recorder if active
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }

        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.isRecording = false;
    }
}

// Global recording manager instance
window.recordingManager = new RecordingManager();
