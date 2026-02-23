// State management to keep track of the secret answer locally in the browser's memory
let currentQuestionData = {
    question: "",
    model_answer: "",
    focus_points: []
};

// 1. Generate Question Logic
document.getElementById('generateBtn').addEventListener('click', async () => {
    const mentorText = document.getElementById('mentorText').value;
    if (!mentorText) return alert("Please paste some text first!");

    toggleLoading(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ 
                mentorText: mentorText, 
                mode: "generate" 
            })
        });

        const data = await response.json();
        
        // Store the AI's response in our state
        currentQuestionData = data;

        // Update UI
        document.getElementById('displayQuestion').innerText = data.question;
        document.getElementById('questionArea').classList.remove('hidden');
        document.getElementById('feedbackArea').classList.add('hidden');
    } catch (error) {
        alert("Error generating question. Check your API key!");
    } finally {
        toggleLoading(false);
    }
});

// 2. Submit Answer Logic
document.getElementById('submitBtn').addEventListener('click', async () => {
    const userResponse = document.getElementById('userAnswer').value;
    const mentorText = document.getElementById('mentorText').value;

    if (!userResponse) return alert("Write an answer first!");

    toggleLoading(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                mode: "evaluate",
                mentorText: mentorText,
                question: currentQuestionData.question,
                modelAnswer: currentQuestionData.model_answer,
                userResponse: userResponse
            })
        });

        const feedback = await response.json();

        // Build the feedback HTML
        document.getElementById('feedbackContent').innerHTML = `
            <div class="score">Score: ${feedback.score}%</div>
            <p><strong>Strengths:</strong> ${feedback.strengths}</p>
            <p><strong>Gaps:</strong> ${feedback.gaps}</p>
            <div class="refined">
                <strong>Try it like this:</strong><br>
                <em>${feedback.refined_version}</em>
            </div>
        `;
        
        document.getElementById('feedbackArea').classList.remove('hidden');
    } catch (error) {
        alert("Error getting feedback.");
    } finally {
        toggleLoading(false);
    }
});

// Helper function to show/hide loading state
function toggleLoading(isLoading) {
    const loader = document.getElementById('loading');
    loader.classList.toggle('hidden', !isLoading);
}
