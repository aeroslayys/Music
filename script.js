const fileInput = document.getElementById("fileInput");
const trackList = document.getElementById("trackList");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const trackTitle = document.getElementById("trackTitle");
const sidebarAlbumArt = document.getElementById("sidebarAlbumArt");
const sidebarArtist = document.getElementById("sidebarArtist");
const progressSlider = document.getElementById("progress");
const volumeSlider = document.getElementById("volume");
const searchInput = document.getElementById("searchInput");
const visualizer = document.getElementById("visualizer");
const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const playlistsTrackList = document.getElementById("playlistsTrackList");
const newPlaylistName = document.getElementById("newPlaylistName");
const createPlaylistBtn = document.getElementById("createPlaylistBtn");
const foldersList = document.getElementById("foldersList");
const shuffleBtn = document.getElementById("shuffleBtn");
const loopBtn = document.getElementById("loopBtn");
const themeSelector = document.getElementById("themeSelector");

let audio = new Audio();
let currentTrackIndex = 0;
let tracks = [];
let playlists = [];
let folders = [];
let currentFolder = null;
let isShuffle = false;
let isLoop = false;
let currentTheme = "auto";
let currentCoverUrl = "";
let audioContext, analyser, dataArray, source;

const supportedFormats = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];

// Read metadata from an audio file
function readMetadata(file, callback) {
  jsmediatags.read(file, {
    onSuccess: function (tag) {
      const artist = tag.tags.artist || "Unknown Artist";
      const title = tag.tags.title || file.name;
      const album = tag.tags.album || "Unknown Album";
      const picture = tag.tags.picture;
      let imageUrl = null;

      if (picture) {
        let base64String = "";
        for (let i = 0; i < picture.data.length; i++) {
          base64String += String.fromCharCode(picture.data[i]);
        }
        imageUrl = `data:${picture.format};base64,${window.btoa(base64String)}`;
      }

      callback({ artist, title, album, imageUrl });
    },
    onError: function (error) {
      console.error("Error reading tags:", error);
      callback({ artist: "Unknown Artist", title: file.name });
    },
  });
}

fileInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files);
  const audioFiles = files.filter((file) =>
    supportedFormats.some((format) => file.name.endsWith(format))
  );

  let albumCover =
    files.find((file) =>
      /\/?cover\.(jpe?g|png)$/i.test(file.webkitRelativePath || file.name)
    ) || files.find((file) => /\.(jpe?g|png)$/i.test(file.name));

  const metadataPromises = audioFiles.map((file) => {
    return new Promise((resolve) => {
      readMetadata(file, (metadata) => {
        resolve({
          file,
          metadata,
        });
      });
    });
  });

  const results = await Promise.all(metadataPromises);

  // Sort by filename or title (customize if needed)
  results.sort((a, b) => a.file.name.localeCompare(b.file.name));

  tracks = results.map((result, index) => {
    const { file, metadata } = result;
    return {
      name: metadata.title.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file),
      artist: metadata.artist,
      index: index,
    };
  });

  if (tracks.length > 0) {
    const first = results[0];
    sidebarArtist.textContent = first.metadata.artist;

    if (first.metadata.imageUrl) {
      currentCoverUrl = first.metadata.imageUrl;
      sidebarAlbumArt.src = currentCoverUrl;
    } else if (albumCover) {
      currentCoverUrl = URL.createObjectURL(albumCover);
      sidebarAlbumArt.src = currentCoverUrl;
    }

    fetchAlbumInfoFromMusicBrainz(first.metadata.artist, first.metadata.album);
    displayArtistDiscography(first.metadata.artist);
  }

  displayTracks();
  playTrack(0);
});

function displayTracks() {
  trackList.innerHTML = "";
  if (tracks.length === 0) {
    trackList.innerHTML = "<li>No tracks found</li>";
    return;
  }
  tracks.forEach((track, index) => {
    const li = document.createElement("li");
    li.textContent = `${track.name}`;
    li.dataset.index = index;
    li.addEventListener("click", () => playTrack(index));
    trackList.appendChild(li);
  });
}

function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  currentTrackIndex = index;
  audio.src = tracks[index].url;
  audio.load();
  audio.play().catch((err) => console.error("Playback error:", err));
  trackTitle.textContent = tracks[index].name;
  sidebarArtist.textContent = tracks[index].artist;
  playBtn.textContent = "❚❚";
  setupVisualizer();
}

playBtn.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = "❚❚";
  } else {
    audio.pause();
    playBtn.textContent = "►";
  }
});

prevBtn.addEventListener("click", () => {
  if (currentTrackIndex > 0) {
    playTrack(currentTrackIndex - 1);
  }
});

nextBtn.addEventListener("click", () => {
  if (currentTrackIndex < tracks.length - 1) {
    playTrack(currentTrackIndex + 1);
  }
});

audio.addEventListener("timeupdate", () => {
  progressSlider.value = (audio.currentTime / audio.duration) * 100;
});

progressSlider.addEventListener("input", () => {
  const seekTime = (progressSlider.value / 100) * audio.duration;
  audio.currentTime = seekTime;
});

volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value;
});

audio.addEventListener("ended", () => {
  if (isLoop) {
    // Loop the current track
    playTrack(currentTrackIndex);
  } else if (isShuffle) {
    // Play a random track from the playlist
    const randomIndex = Math.floor(Math.random() * tracks.length);
    playTrack(randomIndex);
  } else {
    // Default: move to the next track
    if (currentTrackIndex < tracks.length - 1) {
      playTrack(currentTrackIndex + 1);
    } else {
      // After the last track, loop back to the first track
      playTrack(0);
    }
  }
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    pages.forEach((page) => page.classList.remove("active"));
    document.getElementById(`${item.dataset.page}Page`).classList.add("active");
  });
});

function setupVisualizer() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  const canvasContext = visualizer.getContext("2d");
  const width = visualizer.width;
  const height = visualizer.height;

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    canvasContext.fillStyle = "#1e1e1e";
    canvasContext.fillRect(0, 0, width, height);
    const barWidth = (width / dataArray.length) * 2.5;
    let barHeight,
      x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      barHeight = dataArray[i];
      canvasContext.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
      canvasContext.fillRect(
        x,
        height - barHeight / 2,
        barWidth,
        barHeight / 2
      );
      x += barWidth + 1;
    }
  }
  draw();
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  if (theme === "dark" || theme === "light") {
    localStorage.setItem("theme", theme);
  }
}

themeSelector.addEventListener("change", () => {
  currentTheme = themeSelector.value;
  applyTheme(currentTheme);
});

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.style.backgroundColor = isShuffle ? "#87CEEB" : "#ff9800"; // Blue when enabled, original color when disabled
  console.log("Shuffle:", isShuffle); // Debugging line
});

loopBtn.addEventListener("click", () => {
  isLoop = !isLoop;
  loopBtn.style.backgroundColor = isLoop ? "#87CEEB" : "#ff9800";
  console.log("Loop:", isLoop); // Debugging line
});
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  document.querySelectorAll("#trackList li").forEach((li) => {
    li.style.display = li.textContent.toLowerCase().includes(query)
      ? ""
      : "none";
  });
});
// Set dark theme as default when the page loads
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  currentTheme = savedTheme;
  themeSelector.value = savedTheme;
  applyTheme(savedTheme);
});
// Updated fetchYouTubeVideo function with better error handling

// Handle the case where no YouTube video is found or an error occurs
async function fetchAlbumInfoFromMusicBrainz(artist, album) {
  const query = `release:"${album}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FeatherPlayer/1.0 (shwethaparthapmail.com)" },
    });

    const data = await response.json();

    if (data.releases && data.releases.length > 0) {
      const release = data.releases[0];

      document.getElementById("albumTitle").textContent =
        release.title || "Unknown Album";
      document.getElementById("albumArtist").textContent =
        release["artist-credit"]?.[0]?.name || "Unknown Artist";
      document.getElementById("albumDate").textContent =
        release.date || "Unknown Date";
      // Removed genre line, as per request
    } else {
      console.error("No album found for the given artist and album.");
    }
  } catch (error) {
    console.error("Error fetching album data from MusicBrainz:", error);
  }
}

// Function to fetch and display artist's discography if no video is found
// New function to fetch and display artist discography
async function displayArtistDiscography(artistName) {
  const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:"${artistName}"&fmt=json&limit=1`;

  try {
    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "FeatherPlayer/1.0 (shwethaparthiban17@gmail.com)",
      },
    });

    const searchData = await searchResponse.json();
    if (searchData.artists && searchData.artists.length > 0) {
      const artistId = searchData.artists[0].id;

      const releaseGroupUrl = `https://musicbrainz.org/ws/2/release-group?artist=${artistId}&type=album|ep&fmt=json&limit=20`;

      const groupResponse = await fetch(releaseGroupUrl, {
        headers: {
          "User-Agent": "FeatherPlayer/1.0 (shwethaparthiban17@gmail.com)",
        },
      });

      const groupData = await groupResponse.json();

      if (
        groupData["release-groups"] &&
        groupData["release-groups"].length > 0
      ) {
        let discographyHtml = '<div style="font-family: sans-serif;">';

        groupData["release-groups"].forEach((group) => {
          const title = group.title;
          const date = group["first-release-date"] || "Unknown";
          const year = date.substring(0, 4); // Extract only the year
          const type = group["primary-type"] || "Unknown";

          discographyHtml += `
            <div style="margin-bottom: 1em;">
              <div style="font-weight: bold; font-size: 1.1em;">${title}</div>
              <div style="color: #666; font-size: 0.9em;">${year} • ${type}</div>
            </div>
          `;
        });

        discographyHtml += "</div>";
        document.getElementById("artistDiscography").innerHTML =
          discographyHtml;
      } else {
        document.getElementById("artistDiscography").innerHTML =
          "<p>No albums or EPs found.</p>";
      }
    } else {
      document.getElementById("artistDiscography").innerHTML =
        "<p>Artist not found.</p>";
    }
  } catch (error) {
    console.error("Error fetching artist discography:", error);
    document.getElementById("artistDiscography").innerHTML =
      "<p>Could not load artist discography.</p>";
  }
}
