const DEFAULT_COORDS = { lat: 25.033, lon: 121.5654, label: "台北預設位置" };
const app = {
  coords: DEFAULT_COORDS,
  usingFallbackLocation: true,
  isPlaying: false,
  isCompact: false,
  playTimer: null,
  isLive: false,
  liveTimer: null,
  showHorizon: false
};

const elements = {
  sky: document.getElementById("sky-container"),
  sun: document.getElementById("sun"),
  stars: document.querySelector(".stars"),
  location: document.getElementById("location"),
  status: document.getElementById("status"),
  dateInput: document.getElementById("date-input"),
  timeSlider: document.getElementById("time-slider"),
  sliderOutput: document.getElementById("slider-output"),
  timeDisplay: document.getElementById("time-display"),
  skyPhase: document.getElementById("sky-phase"),
  compactTime: document.getElementById("compact-time"),
  compactPhase: document.getElementById("compact-phase"),
  compactSunrise: document.getElementById("compact-sunrise"),
  compactSunset: document.getElementById("compact-sunset"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),
  altitude: document.getElementById("altitude"),
  horizonOverlay: document.getElementById("horizon-overlay"),
  sunriseMarker: document.getElementById("sunrise-marker"),
  sunsetMarker: document.getElementById("sunset-marker"),
  currentMarker: document.getElementById("current-marker"),
  sunriseAzimuth: document.getElementById("sunrise-azimuth"),
  sunsetAzimuth: document.getElementById("sunset-azimuth"),
  currentAzimuth: document.getElementById("current-azimuth"),
  playSlow: document.getElementById("play-slow"),
  toggleInfo: document.getElementById("toggle-info"),
  toggleHorizon: document.getElementById("toggle-horizon"),
  useNow: document.getElementById("use-now"),
  retryLocation: document.getElementById("retry-location")
};

const SKY_COLOR_STOPS = [
  {
    altitude: -24,
    top: [6, 17, 36],
    middle: [17, 27, 63],
    bottom: [12, 16, 32]
  },
  {
    altitude: -12,
    top: [13, 33, 77],
    middle: [81, 51, 124],
    bottom: [180, 91, 106]
  },
  {
    altitude: -6,
    top: [29, 55, 112],
    middle: [143, 74, 104],
    bottom: [231, 131, 92]
  },
  {
    altitude: 0,
    top: [33, 77, 146],
    middle: [215, 111, 82],
    bottom: [255, 209, 138]
  },
  {
    altitude: 8,
    top: [86, 167, 255],
    middle: [155, 216, 255],
    bottom: [255, 227, 168]
  },
  {
    altitude: 45,
    top: [72, 155, 246],
    middle: [143, 207, 255],
    bottom: [210, 233, 224]
  },
  {
    altitude: 90,
    top: [65, 146, 235],
    middle: [128, 199, 250],
    bottom: [200, 225, 222]
  }
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function minutesToLabel(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "--:--";
  }

  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function simulatedDate() {
  const [year, month, day] = elements.dateInput.value.split("-").map(Number);
  const totalMinutes = Number(elements.timeSlider.value);
  const date = new Date(year, month - 1, day);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function mixColor(start, end, amount) {
  return start.map((channel, index) => Math.round(lerp(channel, end[index], amount)));
}

function skyColorsForAltitude(degrees) {
  const stops = SKY_COLOR_STOPS;

  if (degrees <= stops[0].altitude) {
    return stops[0];
  }

  if (degrees >= stops[stops.length - 1].altitude) {
    return stops[stops.length - 1];
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const current = stops[index];
    const next = stops[index + 1];

    if (degrees >= current.altitude && degrees <= next.altitude) {
      const amount = (degrees - current.altitude) / (next.altitude - current.altitude);
      return {
        top: mixColor(current.top, next.top, amount),
        middle: mixColor(current.middle, next.middle, amount),
        bottom: mixColor(current.bottom, next.bottom, amount)
      };
    }
  }

  return stops[0];
}

function phaseLabelForAltitude(degrees) {
  if (degrees > 6) {
    return "白天";
  }

  if (degrees > -1) {
    return "日出或日落";
  }

  if (degrees > -12) {
    return "暮光";
  }

  return "夜晚";
}

function bearingFromAzimuth(azimuthRadians) {
  return (azimuthRadians * 180 / Math.PI + 180 + 360) % 360;
}

function compassDirection(degrees) {
  const directions = [
    "北",
    "北北東",
    "東北東",
    "東",
    "東南東",
    "南南東",
    "南",
    "南南西",
    "西南西",
    "西",
    "西北西",
    "北北西"
  ];
  const index = Math.round(degrees / 30) % directions.length;
  return directions[index];
}

function azimuthLabel(degrees) {
  return `${compassDirection(degrees)} ${Math.round(degrees)} deg`;
}

function markerLeftPercent(degrees) {
  return `${(degrees / 360 * 100).toFixed(2)}%`;
}

function updateAzimuthMarker(marker, labelElement, degrees) {
  marker.style.left = markerLeftPercent(degrees);
  labelElement.textContent = azimuthLabel(degrees);
}

function updateLocationText() {
  const { lat, lon, label } = app.coords;
  const prefix = app.usingFallbackLocation ? `${label}: ` : "";
  elements.location.textContent = `${prefix}緯度 ${lat.toFixed(3)}, 經度 ${lon.toFixed(3)}`;
}

function updateSky() {
  const date = simulatedDate();
  const totalMinutes = Number(elements.timeSlider.value);
  const { lat, lon } = app.coords;
  const position = SunCalc.getPosition(date, lat, lon);
  const altitudeDegrees = position.altitude * 180 / Math.PI;
  const times = SunCalc.getTimes(date, lat, lon);
  const sunrisePosition = SunCalc.getPosition(times.sunrise, lat, lon);
  const sunsetPosition = SunCalc.getPosition(times.sunset, lat, lon);
  const currentBearing = bearingFromAzimuth(position.azimuth);
  const sunriseBearing = bearingFromAzimuth(sunrisePosition.azimuth);
  const sunsetBearing = bearingFromAzimuth(sunsetPosition.azimuth);
  const skyColors = skyColorsForAltitude(altitudeDegrees);
  const starsOpacity = clamp((-altitudeDegrees - 1) / 13, 0, 0.9);
  const sunOpacity = clamp((altitudeDegrees + 8) / 14, 0, 1);
  const timeLabel = minutesToLabel(totalMinutes);
  const phaseLabel = phaseLabelForAltitude(altitudeDegrees);
  const sunriseLabel = formatTime(times.sunrise);
  const sunsetLabel = formatTime(times.sunset);

  elements.timeDisplay.textContent = timeLabel;
  elements.sliderOutput.textContent = timeLabel;
  elements.skyPhase.textContent = phaseLabel;
  elements.compactTime.textContent = timeLabel;
  elements.compactPhase.textContent = phaseLabel;
  elements.sunrise.textContent = sunriseLabel;
  elements.sunset.textContent = sunsetLabel;
  elements.compactSunrise.textContent = sunriseLabel;
  elements.compactSunset.textContent = sunsetLabel;
  updateAzimuthMarker(elements.sunriseMarker, elements.sunriseAzimuth, sunriseBearing);
  updateAzimuthMarker(elements.sunsetMarker, elements.sunsetAzimuth, sunsetBearing);
  updateAzimuthMarker(elements.currentMarker, elements.currentAzimuth, currentBearing);
  elements.altitude.textContent = `${altitudeDegrees.toFixed(1)} deg`;
  elements.sky.style.background = `linear-gradient(180deg, rgb(${skyColors.top.join(" ")}) 0%, rgb(${skyColors.middle.join(" ")}) 56%, rgb(${skyColors.bottom.join(" ")}) 100%)`;
  elements.sky.style.setProperty("--stars-opacity", starsOpacity.toFixed(3));

  const xPercent = Math.min(94, Math.max(6, (totalMinutes / 1439) * 100));
  const yPercent = Math.min(82, Math.max(8, ((altitudeDegrees + 12) / 78) * 74));
  elements.sun.style.left = `${xPercent}%`;
  elements.sun.style.bottom = `${yPercent}%`;
  elements.sun.style.opacity = sunOpacity.toFixed(3);
}

function syncToRealTime() {
  const now = new Date();
  elements.dateInput.value = dateInputValue(now);
  elements.timeSlider.value = now.getHours() * 60 + now.getMinutes();
  updateSky();
}

function stopLiveTracking() {
  if (app.liveTimer) {
    window.clearInterval(app.liveTimer);
    app.liveTimer = null;
  }

  app.isLive = false;
  elements.useNow.textContent = "現在時間";
  elements.useNow.setAttribute("aria-pressed", "false");
}

function stopSlowPlayback() {
  if (app.playTimer) {
    window.clearInterval(app.playTimer);
    app.playTimer = null;
  }

  app.isPlaying = false;
  elements.playSlow.textContent = "慢速播放";
  elements.playSlow.setAttribute("aria-pressed", "false");
}

function advanceSimulationMinute() {
  const currentMinute = Number(elements.timeSlider.value);

  if (currentMinute >= Number(elements.timeSlider.max)) {
    const [year, month, day] = elements.dateInput.value.split("-").map(Number);
    const nextDate = new Date(year, month - 1, day + 1);
    elements.dateInput.value = dateInputValue(nextDate);
    elements.timeSlider.value = 0;
  } else {
    elements.timeSlider.value = currentMinute + 1;
  }

  updateSky();
}

function toggleSlowPlayback() {
  if (app.isPlaying) {
    stopSlowPlayback();
    return;
  }

  stopLiveTracking();
  app.isPlaying = true;
  elements.playSlow.textContent = "暫停播放";
  elements.playSlow.setAttribute("aria-pressed", "true");
  app.playTimer = window.setInterval(advanceSimulationMinute, 360);
}

function toggleInfoDensity() {
  app.isCompact = !app.isCompact;
  elements.sky.classList.toggle("info-compact", app.isCompact);
  elements.toggleInfo.textContent = app.isCompact ? "展開資訊" : "精簡資訊列";
  elements.toggleInfo.setAttribute("aria-pressed", String(app.isCompact));
}

function toggleHorizonOverlay() {
  app.showHorizon = !app.showHorizon;
  elements.horizonOverlay.hidden = !app.showHorizon;
  elements.toggleHorizon.textContent = app.showHorizon ? "隱藏方位線" : "顯示方位線";
  elements.toggleHorizon.setAttribute("aria-pressed", String(app.showHorizon));
}

function setNow() {
  stopSlowPlayback();
  syncToRealTime();

  if (!app.isLive) {
    app.isLive = true;
    elements.useNow.textContent = "跟隨中";
    elements.useNow.setAttribute("aria-pressed", "true");
    app.liveTimer = window.setInterval(syncToRealTime, 1000);
  }
}

function requestLocation() {
  if (!("geolocation" in navigator)) {
    elements.status.textContent = "定位不可用";
    app.usingFallbackLocation = true;
    updateLocationText();
    updateSky();
    return;
  }

  elements.status.textContent = "取得定位中";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      app.coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        label: "目前位置"
      };
      app.usingFallbackLocation = false;
      elements.status.textContent = "GPS 已連接";
      updateLocationText();
      updateSky();
    },
    () => {
      app.coords = DEFAULT_COORDS;
      app.usingFallbackLocation = true;
      elements.status.textContent = "使用預設位置";
      updateLocationText();
      updateSky();
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 10 * 60 * 1000
    }
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}

elements.timeSlider.addEventListener("input", () => {
  stopLiveTracking();
  updateSky();
});
elements.dateInput.addEventListener("change", () => {
  stopLiveTracking();
  updateSky();
});
elements.playSlow.addEventListener("click", toggleSlowPlayback);
elements.toggleInfo.addEventListener("click", toggleInfoDensity);
elements.toggleHorizon.addEventListener("click", toggleHorizonOverlay);
elements.useNow.addEventListener("click", setNow);
elements.retryLocation.addEventListener("click", requestLocation);

elements.dateInput.value = dateInputValue(new Date());
syncToRealTime();
requestLocation();
registerServiceWorker();
