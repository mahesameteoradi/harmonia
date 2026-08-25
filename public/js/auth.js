import { supabase } from './supabase.js';

// --- Toast System ---
function showToast(message, type = 'error') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// --- Auth Guard ---
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  const isLoginPage = window.location.pathname.includes('login.html');

  if (!session && !isLoginPage) {
    window.location.replace('/login.html');
  } else if (session && isLoginPage) {
    window.location.replace('/index.html');
  }
}

// Global Auth State Listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.replace('/login.html');
  }
});

// Run auth check immediately
checkAuth();

// --- Login Form Handler ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('loader');

    // UI Loading State
    btn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      showToast(error.message, 'error');
      // Reset UI
      btn.disabled = false;
      btnText.style.display = 'block';
      loader.style.display = 'none';
    } else {
      showToast('Login berhasil!', 'success');
      // No need to reset UI or manually redirect here, 
      // checkAuth() or onAuthStateChange will handle the redirect.
      setTimeout(() => {
         window.location.replace('/index.html');
      }, 500);
    }
  });
}

// Ekspor utilitas yang berguna
export { showToast };
