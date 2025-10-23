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
let isChangingPage = false; // Prevent double-clicks

// Timer variables
let timerInterval = null;
let timeRemaining = 1500; // 25 minutes in seconds

// Preview stream for equipment test
let previewStream = null;
let audioContext = null;
let audioAnalyser = null;

function startTimer(questionNumber) {
    // Don't reset timer - it should continue across all questions
    // Only initialize on first question
    if (questionNumber === 1) {
        timeRemaining = 1500; // 25 minutes total for all questions
    }

    // Clear any existing timer interval
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const timerDisplay = document.getElementById('timerDisplay' + questionNumber);
    const timerContainer = document.getElementById('timer' + questionNumber);

    // Update display immediately
    updateTimerDisplay(timerDisplay, timerContainer);

    // Start countdown
    timerInterval = setInterval(() => {
        timeRemaining--;

        updateTimerDisplay(timerDisplay, timerContainer);

        // Time's up - auto advance
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);

            // Auto-advance to next question or complete test
            if (questionNumber < 5) {
                goToPage(questionNumber + 5); // Next question page
            } else {
                completeTest(); // Last question, complete test
            }
        }
    }, 1000);
}

function updateTimerDisplay(timerDisplay, timerContainer) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    timerDisplay.textContent = formattedTime;

    // Remove all warning classes first
    timerContainer.classList.remove('warning', 'danger');

    // Add warning when under 5 minutes
    if (timeRemaining <= 300 && timeRemaining > 120) {
        timerContainer.classList.add('warning');
    }
    // Add danger when under 2 minutes
    else if (timeRemaining <= 120) {
        timerContainer.classList.add('danger');
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function stopAllVideos() {
    // Stop both instruction videos
    const videoInstructionsEnglish = document.getElementById('videoInstructionsEnglish');
    if (videoInstructionsEnglish) {
        videoInstructionsEnglish.pause();
        videoInstructionsEnglish.currentTime = 0;
    }

    const videoInstructionsNonEnglish = document.getElementById('videoInstructionsNonEnglish');
    if (videoInstructionsNonEnglish) {
        videoInstructionsNonEnglish.pause();
        videoInstructionsNonEnglish.currentTime = 0;
    }

    // Stop all question videos (Q1-5 are all videos now)
    for (let i = 1; i <= 5; i++) {
        const video = document.getElementById('video' + i);
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    }
}

async function goToPage(pageNumber) {
    // Prevent concurrent calls
    if (isChangingPage) {
        console.log('Already changing pages, ignoring...');
        return;
    }

    isChangingPage = true;

    try {
        const previousPage = currentPage;

        // If leaving a question page, stop timer and upload in background (non-blocking)
        if (previousPage >= 6 && previousPage <= 10 && pageNumber !== previousPage) {
            const questionNum = previousPage - 5;

            // Stop timer
            stopTimer();

            if (window.recordingManager) {
                try {
                    const blob = await window.recordingManager.stopQuestionRecording();
                    // Upload in background - don't wait!
                    window.recordingManager.uploadQuestionRecording(blob, questionNum).catch(err => {
                        console.error(`Background upload Q${questionNum} failed:`, err);
                    });
                } catch (err) {
                    console.error(`Error stopping Q${questionNum}:`, err);
                }
            }
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

        // Scroll to top
        window.scrollTo(0, 0);

        // Auto-play instructions video on page 2
        if (pageNumber === 2) {
            setTimeout(() => {
                const testType = window.testCredentials?.testType || 'ENGLISH';
                const videoId = testType === 'ENGLISH' ? 'videoInstructionsEnglish' : 'videoInstructionsNonEnglish';
                const videoInstructions = document.getElementById(videoId);
                if (videoInstructions) {
                    videoInstructions.currentTime = 0;
                    videoInstructions.play().catch(err => {
                        console.log('Instructions video autoplay prevented:', err);
                    });
                }
            }, 300);
        }

        // Setup equipment test on page 5
        if (pageNumber === 5) {
            setTimeout(() => {
                setupEquipmentTest();
            }, 500);
        }

        // Auto-play video if it's a question page (6-10)
        if (pageNumber >= 6 && pageNumber <= 10) {
            const questionNum = pageNumber - 5;

            // Reset repeat button and counter display for this question
            const repeatButton = document.getElementById('repeat' + questionNum);
            const counter = document.getElementById('counter' + questionNum);
            if (repeatButton && counter) {
                repeatButton.disabled = false;
                repeatButton.textContent = '🔄 Repeat Question';
                counter.textContent = `Repeats remaining: ${repeatCounts[questionNum]}`;
            }

            // Start timer for this question
            startTimer(questionNum);

            // Start recording this question
            if (window.recordingManager) {
                window.recordingManager.startQuestionRecording(questionNum);
            }

            // All questions (Q1-5) use video tags now - play them
            setTimeout(() => {
                const video = document.getElementById('video' + questionNum);
                if (video) {
                    video.currentTime = 0;
                    video.play().catch(err => {
                        console.log('Video autoplay prevented:', err);
                    });
                }
            }, 300);
        }
    } finally {
        setTimeout(() => {
            isChangingPage = false;
        }, 500);
    }
}

async function validatePasscode(passcode) {
    // Call API to check if passcode is in Google Sheet
    try {
        const response = await fetch('/api/validate-passcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: passcode })
        });

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('Error validating passcode:', error);
        return false;
    }
}

async function validateAndSelectTest() {
    const passcode = document.getElementById('passcodeInput').value;
    const check1 = document.getElementById('check1').checked;
    const check2 = document.getElementById('check2').checked;
    const check3 = document.getElementById('check3').checked;
    const check4 = document.getElementById('check4').checked;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const errorMsg = document.getElementById('passcodeError');

    // Validate passcode (now async)
    const isValidPasscode = await validatePasscode(passcode);
    if (!isValidPasscode) {
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

    // Go to test selection page
    goToPage(4);

    // Check which tests have been completed
    setTimeout(() => {
        checkTestCompletion();
    }, 500);
}

async function checkTestCompletion() {
    const loadingDiv = document.getElementById('loadingTests');
    const selectionDiv = document.getElementById('testSelection');
    const englishCard = document.getElementById('englishTestCard');
    const nonEnglishCard = document.getElementById('nonEnglishTestCard');
    const englishStatus = document.getElementById('englishStatus');
    const nonEnglishStatus = document.getElementById('nonEnglishStatus');

    try {
        loadingDiv.style.display = 'block';
        selectionDiv.style.display = 'none';

        // Call API to check completion
        const response = await fetch('/api/check-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: window.testCredentials.passcode })
        });

        const data = await response.json();

        // Check if we got valid data
        if (!response.ok || !data.success || !data.completed) {
            throw new Error('Invalid response from server');
        }

        // Update UI based on completion status
        if (data.completed.english) {
            englishCard.classList.add('disabled');
            englishCard.onclick = null;
            englishStatus.className = 'test-card-status completed';
            englishStatus.textContent = '✅ Already Completed';
        } else {
            englishStatus.className = 'test-card-status available';
            englishStatus.textContent = 'Click to Begin';
        }

        if (data.completed.nonEnglish) {
            nonEnglishCard.classList.add('disabled');
            nonEnglishCard.onclick = null;
            nonEnglishStatus.className = 'test-card-status completed';
            nonEnglishStatus.textContent = '✅ Already Completed';
        } else {
            nonEnglishStatus.className = 'test-card-status available';
            nonEnglishStatus.textContent = 'Click to Begin';
        }

        // Show selection
        loadingDiv.style.display = 'none';
        selectionDiv.style.display = 'block';

    } catch (error) {
        console.error('Error checking completion:', error);
        // If error, just show both tests as available
        englishStatus.className = 'test-card-status available';
        englishStatus.textContent = 'Click to Begin';
        nonEnglishStatus.className = 'test-card-status available';
        nonEnglishStatus.textContent = 'Click to Begin';

        loadingDiv.style.display = 'none';
        selectionDiv.style.display = 'block';
    }
}

function selectTest(testType) {
    // Check if card is disabled
    const card = testType === 'ENGLISH' ? document.getElementById('englishTestCard') : document.getElementById('nonEnglishTestCard');
    if (card.classList.contains('disabled')) {
        alert('You have already completed this test. Please select the other test or contact support.');
        return;
    }

    // Store selected test type
    window.testCredentials.testType = testType;

    // Reset repeat counts for new test
    repeatCounts[1] = 2;
    repeatCounts[2] = 2;
    repeatCounts[3] = 2;
    repeatCounts[4] = 2;
    repeatCounts[5] = 2;

    // Load appropriate instructions
    const englishInstr = document.getElementById('englishInstructions');
    const nonEnglishInstr = document.getElementById('nonEnglishInstructions');

    if (testType === 'ENGLISH') {
        englishInstr.style.display = 'block';
        nonEnglishInstr.style.display = 'none';
    } else {
        englishInstr.style.display = 'none';
        nonEnglishInstr.style.display = 'block';
    }

    // Load question videos dynamically
    loadQuestionVideos(testType);

    // Go to instructions page
    goToPage(2);
}

function loadQuestionVideos(testType) {
    const videos = {
        'ENGLISH': {
            Q1: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761200967/Q1_ENG_tk3fkm.mp4',
            Q2: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761234687/PROF_ENG_Q2_u5h77u.mp4',
            Q3: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761234753/PROF_ENG_Q3_hv0vo8.mp4',
            Q4: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761234803/PROF_ENG_Q4_hvcuft.mp4',
            Q5: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761234857/PROF_ENG_Q5_rswirk.mp4'
        },
        'NONENG': {
            Q1: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761239799/PROF_NONENG_Q1_ggc672.mp4',
            Q2: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761239798/PROF_NONENG_Q2_czmbue.mp4',
            Q3: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761239798/PROF_NONENG_Q3_r4rdtx.mp4',
            Q4: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761239799/PROF_NONENG_Q4_yjaueu.mp4',
            Q5: 'https://res.cloudinary.com/dtkmtinqz/video/upload/v1761239798/PROF_NONENG_Q5_egz5j7.mp4'
        }
    };

    const selectedVideos = videos[testType];

    // Update video sources
    for (let i = 1; i <= 5; i++) {
        const video = document.getElementById('video' + i);
        if (video) {
            const source = video.querySelector('source');
            if (source) {
                source.src = selectedVideos['Q' + i];
                video.load(); // Reload video with new source
            }
        }
    }
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

    // Go to first question (page 6) - recording will start automatically
    goToPage(6);
}

function repeatVideo(questionNumber) {
    if (repeatCounts[questionNumber] > 0) {
        repeatCounts[questionNumber]--;

        // Update counter display
        const counter = document.getElementById('counter' + questionNumber);
        counter.textContent = `Repeats remaining: ${repeatCounts[questionNumber]}`;

        // All questions (Q1-5) use video tags now
        const video = document.getElementById('video' + questionNumber);
        if (video) {
            video.currentTime = 0;
            video.play().catch(err => {
                console.log('Video play prevented:', err);
            });
        }

        // Disable button if no repeats left
        if (repeatCounts[questionNumber] === 0) {
            const button = document.getElementById('repeat' + questionNumber);
            button.disabled = true;
            button.textContent = '❌ No repeats remaining';
        }
    }
}

function repeatInstructions(testType) {
    // Restart instructions video (no limit on repeats)
    const videoId = testType === 'ENGLISH' ? 'videoInstructionsEnglish' : 'videoInstructionsNonEnglish';
    const videoInstructions = document.getElementById(videoId);
    if (videoInstructions) {
        videoInstructions.currentTime = 0;
        videoInstructions.play().catch(err => {
            console.log('Instructions video play prevented:', err);
        });
    }
}

async function completeTest() {
    // Prevent double-clicks
    if (isChangingPage) return;
    isChangingPage = true;

    try {
        // Stop timer and all videos
        stopTimer();
        stopAllVideos();

        // Show upload page
        currentPage = 11;
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById('page11').classList.add('active');
        document.getElementById('uploadSpinner').style.display = 'block';
        document.getElementById('uploadMessage').textContent = 'Finalizing uploads...';

        // Stop Q5 recording and upload it
        if (window.recordingManager) {
            const blob = await window.recordingManager.stopQuestionRecording();
            window.recordingManager.uploadQuestionRecording(blob, 5).catch(err => {
                console.error('Q5 upload failed:', err);
            });

            // Wait for all pending uploads to complete
            await window.recordingManager.waitForAllUploads();

            // Combine videos into one file
            document.getElementById('uploadMessage').textContent = 'Combining videos...';

            try {
                const combineResponse = await fetch('/api/combine', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName: window.testCredentials.firstName,
                        lastName: window.testCredentials.lastName,
                        passcode: window.testCredentials.passcode,
                        testType: window.testCredentials.testType
                    })
                });

                if (combineResponse.ok) {
                    console.log('Videos combined successfully');
                } else {
                    console.error('Video combination failed');
                }
            } catch (error) {
                console.error('Error combining videos:', error);
                // Don't fail the whole test if combination fails
            }
        }

        // Show success
        document.getElementById('uploadSpinner').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'block';
        document.getElementById('uploadMessage').textContent = 'All recordings uploaded successfully!';

        // Wait 2 seconds then show completion
        setTimeout(() => {
            if (window.recordingManager) {
                window.recordingManager.stopAllRecording();
            }

            // Set completion message based on test type
            const testType = window.testCredentials?.testType || 'ENGLISH';
            const testName = testType === 'ENGLISH' ? 'English Proficiency Screening' : 'Non-English Proficiency Screening';
            document.getElementById('completionMessage').textContent = `Thank you for completing the ${testName}!`;

            currentPage = 12;
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.getElementById('page12').classList.add('active');
        }, 2000);

    } catch (error) {
        console.error('Error completing test:', error);
        document.getElementById('uploadSpinner').style.display = 'none';
        document.getElementById('uploadError').style.display = 'block';
        document.getElementById('uploadMessage').textContent = 'Upload failed. Please contact support.';
    } finally {
        isChangingPage = false;
    }
}

function returnToTestSelection() {
    // Reset test credentials (keep passcode and name, clear test type)
    if (window.testCredentials) {
        delete window.testCredentials.testType;
    }

    // Reset timer
    timeRemaining = 1500;

    // Reset repeat counts for all questions
    repeatCounts[1] = 2;
    repeatCounts[2] = 2;
    repeatCounts[3] = 2;
    repeatCounts[4] = 2;
    repeatCounts[5] = 2;

    // Go back to test selection page
    goToPage(4);

    // Re-check completion status
    setTimeout(() => {
        checkTestCompletion();
    }, 500);
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
