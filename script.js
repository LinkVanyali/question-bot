// --- 1. LOGIN & USER TRACKING --- 
let currentUsername = localStorage.getItem('qa_username');

// Check for the user on page load
window.addEventListener('load', () => {
    const overlay = document.getElementById('loginOverlay');
    if (!currentUsername && overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex'; // Ensures the flexbox layout works
    } else if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
});

// Handle the Login Button click
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const name = document.getElementById('usernameInput').value.trim();
            if (name) {
                // Save to browser memory
                localStorage.setItem('qa_username', name);
                currentUsername = name;
                // Hide the overlay
                const overlay = document.getElementById('loginOverlay');
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            } else {
                alert("Please enter a name to continue!");
            }
        });
    }
});

// --- 2. APP STATE (BATCH QUESTION TRACKING) ---
let questionsArray = [];
let currentQuestionIndex = 0;
let savedMentorText = ""; // Locks in the text so they can't change it mid-quiz

// --- 3. GENERATE QUESTIONS LOGIC ---
document.getElementById('generateBtn').addEventListener('click', async () => {
    const mentorTextInput = document.getElementById('mentorText').value;
    if (!mentorTextInput) return alert("Please paste some text first!");

    savedMentorText = mentorTextInput; // Lock the text into state
    toggleLoading(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ 
                mentorText: savedMentorText, 
                mode: "generate" 
            })
        });

        const data = await response.json();
        
        // Our backend prompt forces exactly this JSON structure: { "questions": [...] }
        if (data.questions && data.questions.length > 0) {
            questionsArray = data.questions;
            currentQuestionIndex = 0;
            
            // Load the first question into the UI
            showCurrentQuestion();
            
            // Show the question area
            document.getElementById
