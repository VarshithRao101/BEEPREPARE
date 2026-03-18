/**
 * BEEPREPARE - Centralized Subject Icons
 * Returns <img> tags pointing to the assets in assets/images/subjects/
 * Handles path resolution dynamically.
 */

(function () {
    // Resolve base path for assets
    let basePath = 'assets/'; // Default assumption
    try {
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.src && script.src.includes('assets/js/icons.js')) {
                // Extract part before 'assets/js/icons.js'
                basePath = script.src.split('assets/js/icons.js')[0] + 'assets/';
                break;
            }
        }
    } catch (e) {
        console.warn('BeeIcons: Could not resolve assets path, defaulting to relative fallback.');
    }

    const imgStyle = 'width: 100%; height: 100%; object-fit: contain; display: block;';

    // Helper to generate img tag
    const mkImg = (file, alt) => `<img src="${basePath}images/subjects/${file}" alt="${alt}" style="${imgStyle}">`;

    window.BeeIcons = {
        basePath: basePath,

        // Property Accessors for specific subjects (Pre-generated strings)
        physics: mkImg('physics.svg', 'Physics'),
        chemistry: mkImg('chemistry.svg', 'Chemistry'),
        chemistry2: mkImg('chemistry.svg', 'Chemistry'),
        math: mkImg('mathematics.svg', 'Mathematics'),
        biology: mkImg('biology.svg', 'Biology'),
        english: mkImg('english.svg', 'English'),
        social: mkImg('social.svg', 'Social'),
        science: mkImg('science.svg', 'Science'),
        evs: mkImg('evs.svg', 'EVS'),
        history: mkImg('history.svg', 'History'),
        geography: mkImg('geography.svg', 'Geography'),
        telugu: mkImg('telugu.svg', 'Telugu'),
        hindi: mkImg('hindi.svg', 'Hindi'),
        computer: mkImg('computer.svg', 'Computer'),
        default: mkImg('physics.svg', 'Subject'), // Fallback

        // Dynamic getter
        get: function (subjectName, size = 24, className = '') {
            const key = subjectName.toLowerCase().trim();
            let iconStr = this.default;

            if (key.includes('math') || key.includes('algebra') || key.includes('geometry')) iconStr = this.math;
            else if (key.includes('physic')) iconStr = this.physics;
            else if (key.includes('chemi')) iconStr = this.chemistry;
            else if (key.includes('bio')) iconStr = this.biology;
            else if (key.includes('english') || key.includes('lit')) iconStr = this.english;
            else if (key.includes('telugu')) iconStr = this.telugu;
            else if (key.includes('hindi')) iconStr = this.hindi;
            else if (key.includes('history')) iconStr = this.history;
            else if (key.includes('geography')) iconStr = this.geography;
            else if (key.includes('social')) iconStr = this.social;
            else if (key.includes('science')) iconStr = this.science;
            else if (key.includes('evs') || key.includes('environment')) iconStr = this.evs;
            else if (key.includes('computer') || key.includes('cs') || key.includes('it')) iconStr = this.computer;

            // Inject size/class if needed (modifying the style or class attribute of the img string)
            // Since we return an img string, regex replace can add class or modify width/height
            // But our default style is percentage based (100%), so the container size controls it.
            // If the user passes specific size, we might want to wrap it or modify it.
            // However, the existing usage mostly injects into a container.

            if (className) {
                iconStr = iconStr.replace('<img ', `<img class="${className}" `);
            }
            if (size) {
                // For img tags, usually width/height attributes or style
                // We'll overlay the size into the style
                iconStr = iconStr.replace('style="', `style="width:${size}px; height:${size}px; `);
            }

            return iconStr;
        }
    };
})();

