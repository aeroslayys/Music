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
let isPlaylistPlaying = false;
let playlistIndexes = [];
let playlistIndex = 0;
let isPlaylistMode = false; // Initialize it at the start
let currentAlbum = "";
let currentArtist = "";
let allTracks = []; // Stores all tracks from all folders

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

    // Add click event to switch to normal mode
    li.addEventListener("click", () => {
      // Exit playlist mode if any
      currentPlaylist = null;
      currentPlaylistIndex = null;

      // Update current track index to the clicked track
      currentTrackIndex = index;

      // Start normal playback
      audio.src = track.url;
      audio.play();

      sidebarArtist.textContent = track.artist || "Unknown Artist";
      trackTitle.textContent = track.name || "No Track Playing";
      sidebarAlbumArt.src = track.imageUrl || "assets/images/default-album.png";

      // Fetch album info and artist discography (optional)
      fetchAlbumInfoFromMusicBrainz(track.artist, track.album);
      displayArtistDiscography(track.artist);

      // Handle the "onended" event for normal playback
      audio.onended = () => {
        if (currentTrackIndex < tracks.length - 1) {
          currentTrackIndex++;
          const nextTrack = tracks[currentTrackIndex];
          audio.src = nextTrack.url;
          audio.play();

          sidebarArtist.textContent = nextTrack.artist || "Unknown Artist";
          trackTitle.textContent = nextTrack.name || "No Track Playing";
          sidebarAlbumArt.src =
            nextTrack.imageUrl || "assets/images/default-album.png";

          fetchAlbumInfoFromMusicBrainz(nextTrack.artist, nextTrack.album);
          displayArtistDiscography(nextTrack.artist);
        }
      };
    });

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
  if (currentPlaylist) {
    if (currentPlaylistIndex > 0) {
      currentPlaylistIndex--;
      const track = allTracks[currentPlaylist[currentPlaylistIndex]];
      if (track) {
        audio.src = track.url;
        audio.play();
        sidebarArtist.textContent = track.artist || "Unknown Artist";
        trackTitle.textContent = track.name || "No Track Playing";
        sidebarAlbumArt.src =
          track.imageUrl || "assets/images/default-album.png";
        fetchAlbumInfoFromMusicBrainz(track.artist, track.album);
        displayArtistDiscography(track.artist);
      }
    }
  } else {
    if (currentTrackIndex > 0) {
      playTrack(currentTrackIndex - 1);
    }
  }
});

nextBtn.addEventListener("click", () => {
  if (currentPlaylist) {
    if (currentPlaylistIndex < currentPlaylist.length - 1) {
      currentPlaylistIndex++;
      const track = allTracks[currentPlaylist[currentPlaylistIndex]];
      if (track) {
        audio.src = track.url;
        audio.play();
        sidebarArtist.textContent = track.artist || "Unknown Artist";
        trackTitle.textContent = track.name || "No Track Playing";
        sidebarAlbumArt.src =
          track.imageUrl || "assets/images/default-album.png";
        fetchAlbumInfoFromMusicBrainz(track.artist, track.album);
        displayArtistDiscography(track.artist);
      }
    }
  } else {
    if (currentTrackIndex < tracks.length - 1) {
      playTrack(currentTrackIndex + 1);
    }
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
  if (isPlaylistMode) {
    // Playlist mode logic
    if (currentTrackIndex < playlistTracks.length - 1) {
      // Play the next track in the playlist
      playTrack(playlistTracks[currentTrackIndex + 1]);
      currentTrackIndex++; // Update currentTrackIndex to the next track
    } else {
      // If we're at the end of the playlist, loop back to the first track
      playTrack(playlistTracks[0]);
      currentTrackIndex = 0; // Reset to the start of the playlist
    }
  } else {
    // Normal track playback logic
    if (isLoop) {
      // Loop the current track
      playTrack(currentTrackIndex);
    } else if (isShuffle) {
      // Play a random track from the tracks list
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
    // 1) Create context + analyser + source
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaElementSource(audio);

    // 2) Build your EQ filters
    const eqFreqs = [60, 170, 350, 1000, 3500];
    const eqFilters = eqFreqs.map((freq) => {
      const f = audioContext.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = freq;
      f.Q.value = 1;
      f.gain.value = 0;
      return f;
    });

    // 3) Build a gentle limiter/compressor to prevent clipping
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-3, audioContext.currentTime);
    limiter.knee.setValueAtTime(10, audioContext.currentTime);
    limiter.ratio.setValueAtTime(12, audioContext.currentTime);
    limiter.attack.setValueAtTime(0.005, audioContext.currentTime);
    limiter.release.setValueAtTime(0.05, audioContext.currentTime);

    // 4) Hook up source → eq filters… → limiter → analyser → destination
    source.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(limiter);
    limiter.connect(analyser);
    analyser.connect(audioContext.destination);

    // 5) Store for visualizer
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // 6) Wire each slider to its filter
    eqFreqs.forEach((freq, i) => {
      const slider = document.getElementById(`eq${freq}`);
      if (slider) {
        slider.addEventListener("input", (e) => {
          eqFilters[i].gain.value = parseFloat(e.target.value);
        });
      }
    });

    // 7) Reset‑EQ button
    const resetEqBtn = document.getElementById("resetEqBtn");
    if (resetEqBtn) {
      resetEqBtn.addEventListener("click", () => {
        eqFilters.forEach((f, i) => {
          f.gain.value = 0;
          const s = document.getElementById(`eq${eqFreqs[i]}`);
          if (s) s.value = 0;
        });
      });
    }

    // 8) EQ Toggle: bypass filters & limiter when unchecked
    const eqToggle = document.getElementById("eqToggle");
    if (eqToggle) {
      eqToggle.addEventListener("change", () => {
        // disconnect everything
        source.disconnect();
        eqFilters.forEach((f) => f.disconnect());
        limiter.disconnect();
        analyser.disconnect();

        if (eqToggle.checked) {
          // reconnect through EQ → limiter → analyser
          source.connect(eqFilters[0]);
          for (let i = 0; i < eqFilters.length - 1; i++) {
            eqFilters[i].connect(eqFilters[i + 1]);
          }
          eqFilters[eqFilters.length - 1].connect(limiter);
          limiter.connect(analyser);
        } else {
          // bypass EQ & limiter: source → analyser
          source.connect(analyser);
        }

        // analyser → speaker
        analyser.connect(audioContext.destination);
      });
    }
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
  // Prevent fetching album info if it's the same as the previously fetched one
  if (currentAlbum === album && currentArtist === artist) {
    return;
  }

  const query = `release:"${album}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FeatherPlayer/1.0 (shwethaparthiban17@gmail.com)",
      },
    });

    const data = await response.json();

    if (data.releases && data.releases.length > 0) {
      const release = data.releases[0];

      // Update album info on the page
      document.getElementById("albumTitle").textContent =
        release.title || "Unknown Album";
      document.getElementById("albumArtist").textContent =
        release["artist-credit"]?.[0]?.name || "Unknown Artist";
      document.getElementById("albumDate").textContent =
        release.date || "Unknown Date";

      // Update the current artist and album for future checks
      currentAlbum = album;
      currentArtist = artist;
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
//playlist below
// Handle the creation of the playlist
function handleCreatePlaylist() {
  const nameInput = document.getElementById("playlist-name");
  const selectedIndexes = Array.from(
    document.querySelectorAll("#track-selector input:checked")
  ).map((input) => parseInt(input.value));

  if (nameInput.value && selectedIndexes.length > 0) {
    renderPlaylist(nameInput.value, selectedIndexes);
    savePlaylistsToLocalStorage();
    nameInput.value = "";
    document
      .querySelectorAll("#track-selector input")
      .forEach((i) => (i.checked = false));
  } else {
    alert("Please provide a playlist name and select at least one track.");
  }
}

// Render a playlist div with controls and attach event listeners
function renderPlaylist(name, trackIndexes) {
  const container = document.getElementById("playlists-container");
  const playlistDiv = document.createElement("div");
  playlistDiv.className = "playlist";

  const trackList = trackIndexes.map(
    (i) =>
      `${allTracks[i]?.name || "Unknown"} - ${
        allTracks[i]?.artist || "Unknown"
      }`
  );

  playlistDiv.innerHTML = `
    <div class="playlist-header">
      <strong class="playlist-title">${name}</strong>
      <div class="playlist-controls">
        <button class="play-playlist-btn">▶️</button>
        <button class="edit-playlist-btn">✏️</button>
        <button class="delete-playlist-btn">🗑️</button>
      </div>
    </div>
    <ul class="playlist-tracks">
      ${trackList.map((t) => `<li>${t}</li>`).join("")}
    </ul>
  `;

  playlistDiv.dataset.indexes = JSON.stringify(trackIndexes);
  container.appendChild(playlistDiv);

  // Event listeners
  playlistDiv
    .querySelector(".play-playlist-btn")
    .addEventListener("click", () => {
      playPlaylist(trackIndexes);
    });

  playlistDiv
    .querySelector(".edit-playlist-btn")
    .addEventListener("click", () => {
      const newName = prompt("Edit playlist name:", name);
      if (newName) {
        playlistDiv.querySelector(".playlist-title").textContent = newName;
        savePlaylistsToLocalStorage();
      }
    });

  playlistDiv
    .querySelector(".delete-playlist-btn")
    .addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this playlist?")) {
        playlistDiv.remove();
        savePlaylistsToLocalStorage();
      }
    });
}

// Play all tracks in the playlist one by one
function playPlaylist(trackIndexes) {
  currentPlaylist = trackIndexes;
  currentPlaylistIndex = 0;

  function playNextTrack() {
    // ✅ Exit playlist mode and resume normal playback if playlist is done
    if (currentPlaylistIndex >= currentPlaylist.length) {
      currentPlaylist = null;
      currentPlaylistIndex = null;

      // ✅ Resume from currentTrackIndex in normal playback (if still valid)
      if (currentTrackIndex < tracks.length - 1) {
        currentTrackIndex++;
        const nextTrack = tracks[currentTrackIndex];
        if (nextTrack) {
          audio.src = nextTrack.url;
          audio.play();

          sidebarArtist.textContent = nextTrack.artist || "Unknown Artist";
          trackTitle.textContent = nextTrack.name || "No Track Playing";
          sidebarAlbumArt.src =
            nextTrack.imageUrl || "assets/images/default-album.png";

          fetchAlbumInfoFromMusicBrainz(nextTrack.artist, nextTrack.album);
          displayArtistDiscography(nextTrack.artist);

          audio.onended = () => {
            if (currentTrackIndex < tracks.length - 1) {
              currentTrackIndex++;
              playTrack(currentTrackIndex);
            }
          };
        }
      }

      return;
    }

    const track = allTracks[currentPlaylist[currentPlaylistIndex]];
    if (!track) {
      currentPlaylistIndex++;
      playNextTrack(); // Skip invalid
      return;
    }

    // ✅ Sync currentTrackIndex to keep next/prev working
    currentTrackIndex = track.index || 0;

    audio.src = track.url;
    audio.play();

    sidebarArtist.textContent = track.artist || "Unknown Artist";
    trackTitle.textContent = track.name || "No Track Playing";
    sidebarAlbumArt.src = track.imageUrl || "assets/images/default-album.png";

    fetchAlbumInfoFromMusicBrainz(track.artist, track.album);
    displayArtistDiscography(track.artist);

    audio.onended = () => {
      currentPlaylistIndex++;
      playNextTrack();
    };
  }

  playNextTrack();
}

// Save playlists to localStorage
function savePlaylistsToLocalStorage() {
  const playlists = Array.from(document.querySelectorAll(".playlist")).map(
    (playlistDiv) => {
      const name = playlistDiv.querySelector(".playlist-title").textContent;
      const indexes = JSON.parse(playlistDiv.dataset.indexes || "[]");
      return { name, indexes };
    }
  );
  localStorage.setItem("featherPlaylists", JSON.stringify(playlists));
}

// Load from localStorage on page load
function loadPlaylistsFromLocalStorage() {
  const saved = localStorage.getItem("featherPlaylists");
  if (!saved) return;
  const playlists = JSON.parse(saved);
  playlists.forEach((pl) => renderPlaylist(pl.name, pl.indexes));
}

// Attach event listener to the create button
document
  .getElementById("create-playlist-btn")
  .addEventListener("click", function () {
    handleCreatePlaylist();
  });
function populateTrackSelector() {
  const selector = document.getElementById("track-selector");
  selector.innerHTML = "";
  allTracks.forEach((track, index) => {
    const label = document.createElement("label");
    label.className = "track-option";
    label.innerHTML = `
        <input type="checkbox" value="${index}"> ${track.name} - ${track.artist}
      `;
    selector.appendChild(label);
  });
}

// On page load
populateTrackSelector();
loadPlaylistsFromLocalStorage();

// folder navigation
let folderMap = {};
let parentFolderName = "";

fileInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files);
  const audioFiles = files.filter((file) =>
    supportedFormats.some((format) => file.name.endsWith(format))
  );

  if (files.length > 0) {
    const fullPath = files[0].webkitRelativePath || "";
    parentFolderName = fullPath.split("/")[0];
    document.getElementById("folderLabel").textContent = parentFolderName;
  }

  const metadataPromises = audioFiles.map(
    (file) =>
      new Promise((resolve) => {
        readMetadata(file, (metadata) => {
          resolve({ file, metadata });
        });
      })
  );

  const results = await Promise.all(metadataPromises);

  folderMap = {}; // Reset

  results.forEach((result, index) => {
    const folderPath =
      (result.file.webkitRelativePath || "")
        .split("/")
        .slice(1, -1) // Exclude parent
        .join("/") || "Root";

    if (!folderMap[folderPath])
      folderMap[folderPath] = { tracks: [], cover: null };

    folderMap[folderPath].tracks.push({
      name: result.metadata.title?.replace(/\.[^/.]+$/, "") || result.file.name,
      url: URL.createObjectURL(result.file),
      album: result.metadata.album || "Unknown Album", // <-- ADD THIS
      artist: result.metadata.artist || "Unknown Artist",
      index,
      imageUrl: result.metadata.imageUrl,
    });
    // After building folderMap from uploaded files:
    allTracks = [];
    for (const folderName in folderMap) {
      const folderTracks = folderMap[folderName].tracks || [];
      allTracks.push(...folderTracks);
    }
    populateTrackSelector(); // <- ✅ call it here

    // Set the folder's cover if it's the first track in the folder
    if (!folderMap[folderPath].cover && result.metadata.imageUrl) {
      folderMap[folderPath].cover = result.metadata.imageUrl;
    }
  });

  const folderNames = Object.keys(folderMap);
  displayFolderList(folderNames);

  // Automatically load first folder
  if (folderNames.length) loadTracksFromFolder(folderNames[0]);
});

function displayFolderList(
  folderNames,
  sortBy = "name",
  sortOrder = "asc",
  viewMode = "folder"
) {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = "";

  // Sort the folder names based on the provided criteria (sortBy) and order (sortOrder)
  folderNames.sort((a, b) => {
    const folderA = folderMap[a];
    const folderB = folderMap[b];

    let comparison = 0;
    if (sortBy === "name") {
      comparison = a.localeCompare(b); // Compare folder names alphabetically
    } else if (sortBy === "artist") {
      const artistA = folderA.tracks[0]?.artist || ""; // Grab artist of the first track in the folder
      const artistB = folderB.tracks[0]?.artist || ""; // Grab artist of the first track in the folder
      comparison = artistA.localeCompare(artistB); // Compare by artist
    } else if (sortBy === "album") {
      const albumA = folderA.tracks[0]?.album || ""; // Grab album of the first track in the folder
      const albumB = folderB.tracks[0]?.album || ""; // Grab album of the first track in the folder
      comparison = albumA.localeCompare(albumB); // Compare by album
    }

    // If sortOrder is descending, reverse the comparison result
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // If in folder view mode, display the folders
  if (viewMode === "folder") {
    folderNames.forEach((folderName) => {
      const folder = folderMap[folderName];
      const cover = folder.cover;

      const folderItem = document.createElement("div");
      folderItem.className = "folder-item";
      folderItem.textContent = ""; // We'll show the name as overlay

      if (cover) {
        folderItem.style.backgroundImage = `url(${cover})`;
      }

      const label = document.createElement("span");
      label.className = "folder-name";
      label.textContent = folderName.split("/").pop(); // Exclude parent folder name
      folderItem.appendChild(label);

      folderItem.onclick = () => loadTracksFromFolder(folderName);
      folderList.appendChild(folderItem);
    });
  } else if (viewMode === "tracklist") {
    // If in tracklist view mode, display tracks of the selected folder
    const folderName = folderNames[0]; // Assuming you are selecting the first folder or a specific folder
    const tracks = folderMap[folderName]?.tracks || [];

    tracks.forEach((track) => {
      const trackItem = document.createElement("div");
      trackItem.className = "track-item";
      trackItem.textContent = track.name;

      trackItem.onclick = () => playTrack(track.index); // Play track on click
      folderList.appendChild(trackItem);
    });
  }
}

function loadTracksFromFolder(folderName) {
  tracks = folderMap[folderName]?.tracks || [];
  currentTrackIndex = 0;
  displayTracks();

  if (tracks.length) {
    const firstTrack = tracks[0];
    playTrack(0);

    // Update album art on sidebar
    if (firstTrack.imageUrl) {
      sidebarAlbumArt.src = firstTrack.imageUrl;
    } else {
      sidebarAlbumArt.src = "assets/images/default-album.png";
    }

    // Update album info from MusicBrainz
    fetchAlbumInfoFromMusicBrainz(firstTrack.artist, firstTrack.album);

    // Update artist's discography
    displayArtistDiscography(firstTrack.artist);
    // Update artist and track title
    sidebarArtist.textContent = firstTrack.artist || "Unknown Artist";
    trackTitle.textContent = firstTrack.name || "No Track Playing";
  }
}
