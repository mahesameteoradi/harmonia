import { renderLibrary } from './views/library.js';
import { renderPlaylists } from './views/playlists.js';
import { renderImport } from './views/import.js';

export function initRouter() {
    const mainView = document.getElementById('main-view');
    const navLinks = document.querySelectorAll('.nav-link[data-route]');

    function updateActiveNav(route) {
        navLinks.forEach(link => {
            if (link.dataset.route === route) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    async function handleRoute() {
        // Ambil hash dari URL, default ke 'library'
        let route = window.location.hash.substring(1) || 'library';
        
        updateActiveNav(route);
        
        // Render tampilan yang sesuai
        switch(route) {
            case 'library':
                await renderLibrary(mainView);
                break;
            case 'playlists':
                renderPlaylists(mainView);
                break;
            case 'import':
                renderImport(mainView);
                break;
            default:
                mainView.innerHTML = `<h2>404 - Halaman tidak ditemukan</h2>`;
        }
    }

    // Dengarkan perubahan hash URL
    window.addEventListener('hashchange', handleRoute);
    
    // Tangani klik pada nav link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.dataset.route;
            window.location.hash = route;
        });
    });

    // Panggil saat pertama kali dimuat
    handleRoute();
}
