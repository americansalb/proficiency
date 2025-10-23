// Track repeat counts for each question
const repeatCounts = {
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 2
};

// Current page tracker
let currentPage = 1;

// Preview stream for equipment test
let previewStream = null;
let audioContext = null;
let audioAnalyser = null;

function stopAllVideos() {
    // Stop all question videos
    for (let i = 1; i <= 5; i++) {
        const video = document.getElementById('video' + i);
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    }
}

function goToPage(pageNumber) {
    // Stop all videos before changing pages
    stopAllVideos();
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    document.getElementById('page' + pageNumber).classList.add('active');
    currentPage = pageNumber;
    
    // Auto-play video if it's a question page (5-9)
    if (pageNumber >= 5 && pageNumber <= 9) {
        const videoNum = pageNumber - 4;
        const video = document.getElementById('video' + videoNum);
        if (video) {
            setTimeout(() => {
                video.currentTime = 0;
                video.play();
            }, 500);
        }
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function validatePasscode(passcode) {
    // Remove any spaces or dashes
    const cleaned = passcode.replace(/[\s-]/g, '');
    
    // Check if it's a number
    if (!/^\d+$/.test(cleaned)) {
        return false;
    }
    
    const num = parseInt(cleaned);
    
    // Check if it's in the valid range
    return num >= 1089100800000 && num <= 1089100899999;
}

async function validateAndTestEquipment() {
    const passcode = document.getElementById('passcodeInput').value;
    const check1 = document.getElementById('check1').checked;
    const check2 = document.getElementById('check2').checked;
    const check3 = document.getElementById('check3').checked;
    const check4 = document.getElementById('check4').checked;
    const fullName = document.getElementById('fullName').value.trim();
    const errorMsg = document.getElementById('passcodeError');

    // Validate passcode
    if (!validatePasscode(passcode)) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Invalid passcode. Please enter a valid passcode.';
        return;
    }

    // Validate checkboxes
    if (!check1 || !check2 || !check3 || !check4) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Please check all verification items before proceeding.';
        return;
    }

    // Validate full name
    if (fullName === '') {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Please enter your full name as electronic signature.';
        return;
    }

    // All validation passed
    errorMsg.style.display = 'none';
    
    // Store credentials for later
    window.testCredentials = {
        fullName: fullName,
        passcode: passcode
    };
    
    // Go to equipment test page
    goToPage(4);
    
    // Start equipment test
    setTimeout(() => {
        setupEquipmentTest();
    }, 500);
}

async function setupEquipmentTest() {
    const previewVideo = document.getElementById('previewVideo');
    const audioLevel = document.getElementById('audioLevel');
    const previewStatus = document.getElementById('previewStatus');

    try {
        // Request camera and microphone access
        previewStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        // Show video preview
        previewVideo.srcObject = previewStream;
        
        // Setup audio level detection
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioSource = audioContext.createMediaStreamSource(previewStream);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256;
        audioSource.connect(audioAnalyser);
        
        // Start audio level monitoring
        updateAudioLevel();
        
        // Show success message
        previewStatus.className = 'preview-status success';
        previewStatus.textContent = '✓ Camera and microphone are working!';
        previewStatus.style.display = 'block';
        
    } catch (error) {
        console.error('Error accessing media devices:', error);
        previewStatus.className = 'preview-status error';
        previewStatus.textContent = '✗ Unable to access camera/microphone. Please grant permissions and try again.';
        previewStatus.style.display = 'block';
    }
}

function updateAudioLevel() {
    if (!audioAnalyser) return;
    
    const audioLevel = document.getElementById('audioLevel');
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    
    function animate() {
        if (!audioAnalyser) return;
        
        audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Update audio level bar (0-100%)
        const percentage = Math.min(100, (average / 128) * 100);
        audioLevel.style.width = percentage + '%';
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

async function startTest() {
    // Stop preview stream
    if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
        previewStream = null;
    }
    
    // Stop audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        audioAnalyser = null;
    }
    
    // Request permissions again for recording
    const permissionGranted = await window.recordingManager.requestPermissions();
    
    if (!permissionGranted) {
        alert('Camera and microphone access is required to proceed.');
        return;
    }

    // Start recording with stored credentials
    const recordingStarted = window.recordingManager.startRecording(
        window.testCredentials.fullName, 
        window.testCredentials.passcode
    );
    
    if (!recordingStarted) {
        alert('Failed to start recording. Please try again.');
        return;
    }

    // Log the start
    console.log('Test started at:', new Date().toISOString());
    console.log('Participant:', window.testCredentials.fullName);
    console.log('Passcode:', window.testCredentials.passcode);
    
    // Go to first question (now page 5)
    goToPage(5);
}

function repeatVideo(questionNumber) {
    if (repeatCounts[questionNumber] > 0) {
        repeatCounts[questionNumber]--;
        
        // Update counter display
        const counter = document.getElementById('counter' + questionNumber);
        counter.textContent = `Repeats remaining: ${repeatCounts[questionNumber]}`;
        
        // Replay the video
        const video = document.getElementById('video' + questionNumber);
        if (video) {
            video.currentTime = 0;
            video.play();
        }
        
        // Disable button if no repeats left
        if (repeatCounts[questionNumber] === 0) {
            const button = document.getElementById('repeat' + questionNumber);
            button.disabled = true;
            button.textContent = '❌ No repeats remaining';
        }
    }
}

async function completeTest() {
    // Stop all videos
    stopAllVideos();
    
    // Go to upload page (now page 10)
    goToPage(10);
    document.getElementById('uploadSpinner').style.display = 'block';
    
    try {
        // Get both video and audio blobs
        const { videoBlob, audioBlob } = await window.recordingManager.stopRecording();
        console.log('Recording stopped, starting upload...');
        
        // Upload both recordings (audio first, then video)
        const result = await window.recordingManager.uploadRecording(videoBlob, audioBlob);
        
        // Show success
        document.getElementById('uploadSpinner').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'block';
        
        if (result.audioOnly) {
            document.getElementById('uploadMessage').textContent = 'Audio uploaded successfully! (Video upload failed, but we have your audio recording)';
        } else {
            document.getElementById('uploadMessage').textContent = 'Your test has been submitted successfully!';
        }
        
        // Go to completion page after 2 seconds (now page 11)
        setTimeout(() => {
            goToPage(11);
        }, 2000);
        
    } catch (error) {
        console.error('Error completing test:', error);
        document.getElementById('uploadSpinner').style.display = 'none';
        document.getElementById('uploadError').style.display = 'block';
        document.getElementById('uploadMessage').textContent = 'There was an error uploading your recording.';
    }
}

// Allow Enter key to submit passcode
document.addEventListener('DOMContentLoaded', function() {
    const passcodeInput = document.getElementById('passcodeInput');
    if (passcodeInput) {
        passcodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                validateAndTestEquipment();
            }
        });
    }
});

// Stop videos when user leaves the page
window.addEventListener('beforeunload', function() {
    stopAllVideos();
    
    // Stop preview if active
    if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
    }
    
    if (window.recordingManager && window.recordingManager.isRecording) {
        // Try to save recording if user leaves mid-test
        window.recordingManager.stopRecording().catch(console.error);
    }
});
