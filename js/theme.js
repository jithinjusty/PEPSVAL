// /js/theme.js

(function () {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-mode');
    }
})();

export function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    return isDark;
}

export function getCurrentTheme() {
    return localStorage.getItem('theme') || 'light';
}
