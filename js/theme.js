const STORAGE_KEY = 'theme';

export const ThemeManager = {
    init() {
        this.toggleBtn = document.getElementById('theme-toggle');
        if (!this.toggleBtn) return;

        this.toggleBtn.addEventListener('click', () => this.toggle());

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark') {
            this.apply('dark');
        } else if (saved === 'light') {
            this.apply('light');
        } else {
            // Follow OS preference by default
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.apply(prefersDark ? 'dark' : 'light');
        }
    },

    apply(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
            localStorage.setItem(STORAGE_KEY, 'dark');
            this._updateButton(true);
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
            localStorage.setItem(STORAGE_KEY, 'light');
            this._updateButton(false);
        }
    },

    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        this.apply(isDark ? 'light' : 'dark');
    },

    _updateButton(isDark) {
        if (!this.toggleBtn) return;
        this.toggleBtn.setAttribute('aria-pressed', String(isDark));
        const icon = this.toggleBtn.querySelector('.theme-icon');
        if (icon) {
            // small fade animation when swapping emoji
            icon.style.transition = 'opacity 140ms linear';
            icon.style.opacity = '0';
            setTimeout(() => {
                icon.textContent = isDark ? '🌙' : '☀️';
                icon.style.opacity = '1';
            }, 160);
        }
    }
};
