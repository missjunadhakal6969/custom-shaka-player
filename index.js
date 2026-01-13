let player, video;
let showRemaining = false;
const settingsMenu = document.getElementById('settings-menu');
const centerControls = document.getElementById('center-controls');
const statsPanel = document.getElementById('stats-panel');
const progressBar = document.getElementById('progress-bar');
const progressKnob = document.getElementById('progress-knob');
const progressContainer = document.getElementById('progress-container');

async function initPlayer() {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) return;

    video = document.getElementById('video');
    player = new shaka.Player(video);

    // Listen for errors
    player.addEventListener('error', (e) => console.error('Shaka Error', e));

    try {
        await player.load('https://habetar.com/stream/itIgk4ozBM9qbKRmiJOAfA/kjhhiuahiuhgihdf/1768361276/66965491/master.m3u8');
        setupUIHandlers();
        buildVideoTracks();
        buildAudioTracks();
        buildSubtitleTracks();
        startStatsInterval();
    } catch (e) {
        console.error('Load Error', e);
    }
}

function setupUIHandlers() {
    // Play/Pause
    const playBtn = document.getElementById('mainPlayBtn');
    playBtn.onclick = () => {
        if (video.paused) {
            video.play();
            playBtn.src = './icons/pause.svg';
        } else {
            video.pause();
            playBtn.src = './icons/play.svg';
        }
    };

    // Settings Toggle
    document.getElementById('setting-btn').onclick = (e) => {
        e.stopPropagation();
        const isActive = settingsMenu.classList.toggle('active');
        centerControls.classList.toggle('hidden', isActive);
        statsPanel.classList.remove('active'); // Close stats if settings open
    };

    // 5. Loading Indicator logic
    player.addEventListener('buffering', (e) => {
        document.getElementById('loader').style.display = e.buffering ? 'block' : 'none';
    });
    // Info Toggle
    document.getElementById('info-btn').onclick = (e) => {
        e.stopPropagation();
        statsPanel.classList.toggle('active');
    };

    // Fullscreen
    document.getElementById('fullscreen-btn').onclick = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    };

    // Progress Bar Logic
    video.addEventListener('timeupdate', updateProgress);
    progressContainer.onclick = (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.pageX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    };

    // Speed Controls
    document.querySelectorAll('#speed-list .option-item').forEach(item => {
        item.onclick = () => {
            video.playbackRate = parseFloat(item.textContent);
            activateItem(document.getElementById('speed-list'), item);
        };
    });

    // Aspect Ratio
    document.querySelectorAll('#aspect-list .option-item').forEach(item => {
        item.onclick = () => {
            video.style.objectFit = item.textContent.toLowerCase();
            activateItem(document.getElementById('aspect-list'), item);
        };
    });

    // Close menus on outside click
    document.onclick = (e) => {
        if (!e.target.closest('.setting-section')) {
            settingsMenu.classList.remove('active');
            centerControls.classList.remove('hidden');
        }
        if (!e.target.closest('#info-btn') && !e.target.closest('#stats-panel')) {
            statsPanel.classList.remove('active');
        }
    };
}

document.getElementById('total-time').onclick = () => {
    showRemaining = !showRemaining;
    updateProgress();
};


function updateProgress() {
    if (!video.duration) return;
    const percent = (video.currentTime / video.duration) * 100;
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-knob').style.left = percent + '%';

    document.getElementById('current-time').textContent = formatTime(video.currentTime);

    const totalTimeEl = document.getElementById('total-time');
    if (showRemaining) {
        totalTimeEl.textContent = "-" + formatTime(video.duration - video.currentTime);
    } else {
        totalTimeEl.textContent = formatTime(video.duration);
    }
}

function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return "00:00";
    const hrs = Math.floor(sec / 3600);
    const min = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return (hrs > 0 ? hrs + ":" : "") + (min < 10 ? "0" + min : min) + ":" + (s < 10 ? "0" + s : s);
}

function seekBy(val) {
    video.currentTime += val;
}

function activateItem(container, item) {
    container.querySelectorAll('.option-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
}

/* 1. AUTO + QUALITY Logic */
function buildVideoTracks() {
    const list = document.getElementById('video-list');
    list.innerHTML = '';

    // Auto Option
    const auto = document.createElement('div');
    auto.className = 'option-item active';
    auto.textContent = 'Auto';
    auto.onclick = () => {
        player.configure({
            abr: {
                enabled: true
            }
        });
        activateItem(list, auto);
    };
    list.appendChild(auto);

    const tracks = player.getVariantTracks();
    const unique = [...new Map(tracks.map(t => [t.height, t])).values()].sort((a, b) => b.height - a.height);

    unique.forEach(track => {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.textContent = `${track.height}p`;
        div.onclick = () => {
            player.configure({
                abr: {
                    enabled: false
                }
            });
            player.selectVariantTrack(track, true);
            activateItem(list, div);
        };
        list.appendChild(div);
    });
}


/* =============================== PIP ================================ */
document.querySelector('.pip-btn').onclick = async () => {
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
    } else {
        await video.requestPictureInPicture();
    }
};


function buildAudioTracks() {
    const list = document.getElementById('audio-list');
    list.innerHTML = '';

    // 2. Add Audio Off Option
    const off = document.createElement('div');
    off.className = 'option-item';
    off.textContent = 'Off';
    off.onclick = () => {
        video.muted = true;
        activateItem(list, off);
    };
    list.appendChild(off);

    const langs = player.getAudioLanguages();
    langs.forEach(lang => {
        const div = document.createElement('div');
        div.className = 'option-item';
        if (!video.muted && player.getConfiguration().preferredAudioLanguage === lang) div.classList.add('active');
        div.textContent = lang.toUpperCase();
        div.onclick = () => {
            video.muted = false;
            player.selectAudioLanguage(lang);
            activateItem(list, div);
        };
        list.appendChild(div);
    });
}

/* 2. SUBTITLE Logic (Off + No Tracks) */
function buildSubtitleTracks() {
    const list = document.getElementById('subtitle-list');
    list.innerHTML = '';
    const tracks = player.getTextTracks();

    if (tracks.length === 0) {
        const none = document.createElement('div');
        none.className = 'option-item disabled';
        none.textContent = 'No Tracks';
        list.appendChild(none);
    } else {
        const off = document.createElement('div');
        off.className = 'option-item active';
        off.textContent = 'Off';
        off.onclick = () => {
            player.setTextTrackVisibility(false);
            activateItem(list, off);
        };
        list.appendChild(off);

        tracks.forEach(track => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.textContent = track.label || track.language.toUpperCase();
            div.onclick = () => {
                player.setTextTrackVisibility(true);
                player.selectTextTrack(track);
                activateItem(list, div);
            };
            list.appendChild(div);
        });
    }
}

/* 3. REAL STATS Logic */
function startStatsInterval() {
    setInterval(() => {
        if (!statsPanel.classList.contains('active')) return;
        const stats = player.getStats();
        const variant = player.getVariantTracks().find(t => t.active);
        console.log(variant)
        document.getElementById('stat-res').textContent = variant ? `${variant.width}x${variant.height}` : 'N/A';
        document.getElementById('stat-codec').textContent = variant ? variant.videoCodec : 'N/A';
        document.getElementById('stat-fps').textContent = variant.frameRate
        document.getElementById('stat-dropped').textContent = stats.droppedFrames;
        document.getElementById('stat-buffer').textContent = player.getBufferedInfo().total[0] ?
            (player.getBufferedInfo().total[0].end - video.currentTime).toFixed(1) + 's' : '0s';
        document.getElementById('stat-bitrate').textContent = (stats.streamBandwidth / 1000000).toFixed(2) + ' Mbps';
    }, 1000);
}


document.addEventListener('DOMContentLoaded', initPlayer);
