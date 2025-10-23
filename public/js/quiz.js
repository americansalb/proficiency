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

async function goToPage(pageNumber) {
    const previousPage = currentPage;
    
    // If leaving a question page (5-9), stop and upload that question FIRST
    if (previousPage >= 5 && previousPage <= 9 && pageNumber !== previousPage) {
        const questionNum = previousPage - 4;
        await stopAndUploadQuestion(questionNum);
    }
    
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
        const questionNum = pageNumber - 4;
        const video = document.getElementById('video' + questionNum);
        if (video) {
            setTimeout(() => {
                video.currentTime = 0;
                video.play();
            }, 500);
        }
        
        // Start recording for this NEW question
        if (window.recordingManager) {
            window.recordingManager.startQuestionRecording(questionNum);
        }
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

async function stopAndUploadQuestion(questionNum) {
    try {
        console.log(`Stopping and uploading question ${questionNum}...`);
        
        // Stop recording
        const blob = await window.recordingManager.stopQuestionRecording();
        
        // Upload immediately
        await window.recordingManager.uploadQuestionRecording(blob);
        
        console.log(`Question ${questionNum} uploaded successfully!`);
    } catch (error) {
        console.error(`Error uploading question ${questionNum}:`, error);
        alert(`Warning: Question ${questionNum} upload failed. Please contact support.`);
    }
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
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
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

    // Validate names
    if (firstName === '' || lastName === '') {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Please enter your first and last name.';
        return;
    }

    // All validation passed
    errorMsg.style.display = 'none';
    
    // Store credentials for later
    window.testCredentials = {
        firstName: firstName,
        lastName: lastName,
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

    // Set participant info
    window.recordingManager.setParticipantInfo(
        window.testCredentials.firstName, 
        window.testCredentials.lastName,
        window.testCredentials.passcode
    );

    // Log the start
    console.log('Test started at:', new Date().toISOString());
    console.log('Participant:', window.testCredentials.firstName, window.testCredentials.lastName);
    console.log('Passcode:', window.testCredentials.passcode);
    
    // Go to first question (page 5) - recording will start automatically
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
    
    // Stop and upload the last question (Question 5)
    await stopAndUploadQuestion(5);
    
    // Stop all recording completely
    window.recordingManager.stopAllRecording();
    
    // Go to completion page
    goToPage(11);
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
    
    if (window.recordingManager) {
        window.recordingManager.stopAllRecording();
    }
});
