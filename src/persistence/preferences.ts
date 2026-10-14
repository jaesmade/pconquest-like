const weatherAnimationsKey = 'pokemon-tactics-weather-animations';

export function loadWeatherAnimationsEnabled(): boolean {
  try { return localStorage.getItem(weatherAnimationsKey) !== 'false'; }
  catch { return true; }
}

export function saveWeatherAnimationsEnabled(enabled: boolean) {
  try { localStorage.setItem(weatherAnimationsKey, String(enabled)); }
  catch { /* The preference remains active in memory when storage is unavailable. */ }
}
