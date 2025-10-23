// Video ID mapping (replace these with your actual video IDs)
const videoIds = {
    instructions: '3WYNhilLu4g',
    1: '3WYNhilLu4g',
    2: '3WYNhilLu4g',
    3: '3WYNhilLu4g',
    4: '3WYNhilLu4g',
    5: '3WYNhilLu4g'
};

// YouTube player objects
const players = {};

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

// YouTube API Ready
function onYouTubeIframeAPIReady() {
    // Initialize instructions player
    players.instructions = new YT.Player('instructionsPlayer', {
        height: '450',
        width: '100%',
        videoId: videoIds.instructions,
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0,
            'fs': 0,
            'disablekb': 1
        }
    });

    // Initialize question players
    for (let i = 1; i <= 5; i++) {
        players[i] = new YT.Player('player' + i, {
            height: '450',
            width: '100%',
            videoId: videoIds[i],
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'modestbranding': 1,
                'rel': 0,
                'fs': 0,
                'disablekb': 1
            }
        });
    }
}

function stopAllVideos() {
    // Stop instructions video
    if (players.instructions && players.instructions.pauseVideo) {
        players.instructions.pauseVideo();
    }
    
    // Stop all question videos
    for (let i = 1; i <= 5; i++) {
        if (players[i] && players[i].pauseVideo) {
            players[i].pauseVideo();
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
    
    // Auto-play video if it's page 2 or a question page (4-8)
    setTimeout(() => {
        if (pageNumber === 2 && players.instructions && players.instructions.playVideo) {
            players.instructions.seekTo(0);
            players.instructions.playVideo();
        } else if (pageNumber >= 4 && pageNumber <= 8) {
            const questionNum = pageNumber - 3;
            if (players[questionNum] && players[questionNum].playVideo) {
                players[questionNum].seekTo(0);
                players[questionNum].playVideo();
            }
        }
    }, 500);
    
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

async function validateAndBegin() {
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
    
    // Request camera/microphone permissions
    const permissionGranted = await window.recordingManager.requestPermissions();
    
    if (!permissionGranted) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Camera and microphone access is required to proceed.';
        return;
    }

    // Start recording
    const recordingStarted = window.recordingManager.startRecording(fullName, passcode);
    
    if (!recordingStarted) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Failed to start recording. Please try again.';
        return;
    }

    // Log the start
    console.log('Test started at:', new Date().toISOString());
    console.log('Participant:', fullName);
    console.log('Passcode:', passcode);
    
    goToPage(4);
}

function repeatVideo(questionNumber) {
    if (repeatCounts[questionNumber] > 0) {
        repeatCounts[questionNumber]--;
        
        // Update counter display
        const counter = document.getElementById('counter' + questionNumber);
        counter.textContent = `Repeats remaining: ${repeatCounts[questionNumber]}`;
        
        // Replay the video using YouTube API
        if (players[questionNumber] && players[questionNumber].seekTo) {
            players[questionNumber].seekTo(0);
            players[questionNumber].playVideo();
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
    // Stop recording
    goToPage(9);
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
        
        // Go to completion page after 2 seconds
        setTimeout(() => {
            goToPage(10);
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
                validateAndBegin();
            }
        });
    }
});

// Stop videos when user leaves the page
window.addEventListener('beforeunload', function() {
    stopAllVideos();
    if (window.recordingManager && window.recordingManager.isRecording) {
        // Try to save recording if user leaves mid-test
        window.recordingManager.stopRecording().catch(console.error);
    }
});
