document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authAlert = document.getElementById('auth-alert');

    // --- Show Authentication Errors ---
    const showAlert = (message) => {
        authAlert.textContent = message;
        authAlert.style.display = 'block';
    };

    // --- Login Handler ---
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Signed in
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    showAlert(error.message);
                });
        });
    }

    // --- Sign Up Handler ---
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Signed in 
                    showAlert('Account created successfully! Logging you in...');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                })
                .catch((error) => {
                    showAlert(error.message);
                });
        });
    }
});
