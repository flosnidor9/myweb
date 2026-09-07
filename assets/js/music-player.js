const PLAYLIST_ID = 'PLdbIhLq8RrtA';
const DEFAULT_VOLUME = 20;
const VOLUME_KEY = 'musicVolume';

function getSavedVolume() {
  const saved = localStorage.getItem(VOLUME_KEY);
  return saved !== null ? Number(saved) : DEFAULT_VOLUME;
}

function applyVolume(volume) {
  volumeInput.value = String(volume);
  volumeValue.textContent = `${volume}%`;
  localStorage.setItem(VOLUME_KEY, String(volume));
}

const status = document.getElementById('music-status');
const title = document.getElementById('music-title');
const visualizer = document.getElementById('music-visualizer');
const playButton = document.getElementById('music-play');
const pauseButton = document.getElementById('music-pause');
const nextButton = document.getElementById('music-next');
const volumeInput = document.getElementById('music-volume');
const volumeValue = document.getElementById('music-volume-value');
const progressInput = document.getElementById('music-progress');
const currentTime = document.getElementById('music-current-time');
const durationTime = document.getElementById('music-duration');

let player;
let apiReady;
let playerReady = false;
let playlistCued = false;
let progressTimer;

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function updatePlaybackDetails() {
  if (!playerReady) return;
  const duration = player.getDuration();
  const current = player.getCurrentTime();
  const video = player.getVideoData();

  currentTime.textContent = formatTime(current);
  durationTime.textContent = formatTime(duration);
  progressInput.value = duration > 0 ? String((current / duration) * 100) : '0';
  if (video?.title) title.textContent = video.title;
}

function setPlaying(isPlaying) {
  visualizer.classList.toggle('is-playing', isPlaying);
  window.clearInterval(progressTimer);
  if (isPlaying) {
    updatePlaybackDetails();
    progressTimer = window.setInterval(updatePlaybackDetails, 500);
  } else {
    updatePlaybackDetails();
    progressTimer = undefined;
  }
}

function loadYouTubeApi() {
  if (apiReady) return apiReady;

  apiReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', () => reject(new Error('YouTube API를 불러오지 못했습니다.')));
    window.onYouTubeIframeAPIReady = resolve;
    document.head.append(script);
  });

  return apiReady;
}

async function createPlayer() {
  if (player) return player;

  status.textContent = 'YouTube 플레이어를 준비하는 중…';
  await loadYouTubeApi();

  await new Promise((resolve) => {
    player = new window.YT.Player('youtube-music-player', {
      width: '360',
      height: '200',
      playerVars: { listType: 'playlist', list: PLAYLIST_ID, playsinline: 1, rel: 0, origin: window.location.origin },
      events: {
        onReady: (event) => {
          event.target.setVolume(getSavedVolume());
          event.target.unMute();
          playerReady = true;
          status.textContent = '재생목록을 불러오는 중…';
          event.target.cuePlaylist({ listType: 'playlist', list: PLAYLIST_ID });
          resolve();
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.CUED) {
            event.target.setShuffle(true);
            event.target.setLoop(true);
            playlistCued = true;
            playButton.disabled = false;
            pauseButton.disabled = false;
            nextButton.disabled = false;
            progressInput.disabled = false;
            status.textContent = '셔플이 준비됐어요. 재생 버튼을 눌러 시작하세요.';
            updatePlaybackDetails();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            status.textContent = '셔플 재생 중';
            setPlaying(true);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            status.textContent = '일시정지됨';
            setPlaying(false);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            status.textContent = '다음 곡을 불러오는 중…';
            setPlaying(false);
          }
        },
        onAutoplayBlocked: () => { status.textContent = '브라우저가 자동 재생을 막았어요. 재생 버튼을 다시 눌러 주세요.'; },
        onError: () => {
          setPlaying(false);
          status.textContent = '이 재생목록의 일부 영상을 재생할 수 없어요.';
        },
      },
    });
  });

  return player;
}

const handlePlayerInit = () => {
  createPlayer().catch((error) => {
    status.textContent = 'YouTube 플레이어를 불러오지 못했어요. 연결 상태를 확인해 주세요.';
    console.error(error);
  });
};

document.getElementById('ico-music').addEventListener('click', handlePlayerInit);
document.getElementById('win-music').addEventListener('win-open', handlePlayerInit);

// 이전 세션에서 창이 열린 상태로 복원된 경우 플레이어 초기화 (window-ui.js의 load 이후 실행)
window.addEventListener('load', () => {
  const musicWindow = document.getElementById('win-music');
  if (musicWindow?.classList.contains('open') || musicWindow?.style.display === 'block') {
    handlePlayerInit();
  }
});

playButton.addEventListener('click', () => {
  if (!playerReady || !playlistCued) return;
  player.setVolume(Number(volumeInput.value));
  player.unMute();
  player.playVideo();
});
pauseButton.addEventListener('click', () => player?.pauseVideo());
nextButton.addEventListener('click', () => player?.nextVideo());
volumeInput.addEventListener('input', () => {
  const volume = Number(volumeInput.value);
  applyVolume(volume);
  if (playerReady) {
    player.setVolume(volume);
    if (volume > 0) player.unMute();
  }
});

applyVolume(getSavedVolume());
progressInput.addEventListener('input', () => {
  if (!playerReady) return;
  const duration = player.getDuration();
  if (duration > 0) player.seekTo((Number(progressInput.value) / 100) * duration, true);
});
