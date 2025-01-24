let locationData = null;

// 添加緩存控制
const CACHE_DURATION = 10 * 60 * 1000; // 10分鐘緩存
let weatherCache = {
    data: null,
    timestamp: null
};

async function getLocation(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        const data = await response.json();
        return data.address.city || data.address.town || data.address.county || '未知位置';
    } catch (error) {
        console.error('獲取位置名稱失敗:', error);
        return '未知位置';
    }
}

function formatDate(date) {
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 ${weekday}`;
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    return `${hours}:00`;
}

async function getWeather(lat, lon) {
    try {
        // 檢查緩存
        if (weatherCache.data && weatherCache.timestamp && 
            (Date.now() - weatherCache.timestamp < CACHE_DURATION)) {
            return handleWeatherData(weatherCache.data);
        }

        // 同時發起請求並等待所有請求完成
        const [weatherResponse, locationResponse] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?` +
                `latitude=${lat}&longitude=${lon}` +
                `&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m,winddirection_10m` +
                `&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,windspeed_10m_max` +
                `&current_weather=true` +
                `&timezone=Asia%2FTaipei`
            ),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        ]);

        const [weatherData, locationData] = await Promise.all([
            weatherResponse.json(),
            locationResponse.json()
        ]);

        // 更新緩存
        weatherCache.data = { weatherData, locationData };
        weatherCache.timestamp = Date.now();

        return handleWeatherData({ weatherData, locationData });
    } catch (error) {
        handleError(error);
    }
}

function handleWeatherData({ weatherData, locationData }) {
    // 隱藏載入動畫
    document.getElementById('loading-spinner').style.display = 'none';

    // 顯示內容並添加動畫
    const elements = [
        document.querySelector('.current-weather'),
        document.querySelector('.hourly-forecast'),
        document.querySelector('.daily-forecast')
    ];

    elements.forEach((element, index) => {
        setTimeout(() => {
            element.style.display = 'block';
            element.classList.add('fade-in');
        }, index * 100);
    });

    // 設置位置和日期
    const locationName = locationData.address.city || 
                        locationData.address.town || 
                        locationData.address.county || 
                        '未知位置';
    document.getElementById('location').textContent = locationName;
    document.getElementById('current-date').textContent = formatDate(new Date());

    // 顯示天氣數據
    displayCurrentWeather(weatherData);
    displayHourlyForecast(weatherData.hourly);
    displayDailyForecast(weatherData);
}

function handleError(error) {
    console.error('獲取數據失敗:', error);
    document.getElementById('loading-spinner').style.display = 'none';
    document.querySelector('.current-weather').innerHTML = `
        <h2>錯誤</h2>
        <div>獲取天氣數據失敗: ${error.message}</div>
    `;
    document.querySelector('.current-weather').style.display = 'block';
}

function getWeatherDescription(code) {
    const weatherCodes = {
        0: '晴天',
        1: '晴時多雲',
        2: '多雲',
        3: '陰天',
        45: '霧',
        48: '霧凇',
        51: '毛毛雨',
        53: '小雨',
        55: '中雨',
        56: '凍雨',
        57: '強凍雨',
        61: '小雨',
        63: '中雨',
        65: '大雨',
        66: '凍雨',
        67: '凍雨',
        71: '小雪',
        73: '中雪',
        75: '大雪',
        77: '雪粒',
        80: '小陣雨',
        81: '中陣雨',
        82: '大陣雨',
        85: '小陣雪',
        86: '大陣雪',
        95: '雷雨',
        96: '雷雨伴隨冰雹',
        99: '雷雨伴隨大冰雹'
    };
    return weatherCodes[code] || '未知天氣';
}

function displayCurrentWeather(data) {
    const currentTemp = document.getElementById('current-temp');
    const currentDesc = document.getElementById('current-desc');
    const currentDetails = document.getElementById('current-details');
    
    currentTemp.innerHTML = `${Math.round(data.current_weather.temperature)}°C`;
    currentDesc.innerHTML = getWeatherDescription(data.current_weather.weathercode);
    
    // 獲取當前小時的詳細數據
    const currentHourIndex = data.hourly.time.findIndex(time => 
        new Date(time).getHours() === new Date().getHours()
    );

    currentDetails.innerHTML = `
        <div class="weather-detail">
            <span>體感溫度</span>
            <span>${Math.round(data.hourly.apparent_temperature[currentHourIndex])}°C</span>
        </div>
        <div class="weather-detail">
            <span>濕度</span>
            <span>${data.hourly.relativehumidity_2m[currentHourIndex]}%</span>
        </div>
        <div class="weather-detail">
            <span>降雨機率</span>
            <span>${data.hourly.precipitation_probability[currentHourIndex]}%</span>
        </div>
        <div class="weather-detail">
            <span>風速</span>
            <span>${data.hourly.windspeed_10m[currentHourIndex]} km/h</span>
        </div>
        <div class="weather-detail">
            <span>日出</span>
            <span>${new Date(data.daily.sunrise[0]).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="weather-detail">
            <span>日落</span>
            <span>${new Date(data.daily.sunset[0]).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
    `;
}

function displayHourlyForecast(hourly) {
    const container = document.getElementById('hourly-container');
    container.innerHTML = '';

    const currentHour = new Date().getHours();
    const startIndex = hourly.time.findIndex(time => {
        const hour = new Date(time).getHours();
        return hour > currentHour;
    });

    for (let i = startIndex; i < startIndex + 24; i++) {
        const time = new Date(hourly.time[i]);
        const div = document.createElement('div');
        div.className = 'forecast-item';
        div.innerHTML = `
            <div>${formatTime(time)}</div>
            <div class="temp">${Math.round(hourly.temperature_2m[i])}°C</div>
            <div class="feels-like">體感 ${Math.round(hourly.apparent_temperature[i])}°C</div>
            <div class="weather-icon">${getWeatherDescription(hourly.weathercode[i])}</div>
            <div class="precipitation">降雨 ${hourly.precipitation_probability[i]}%</div>
            <div class="wind">
                <span>${Math.round(hourly.windspeed_10m[i])} km/h</span>
                <span class="wind-direction" style="transform: rotate(${hourly.winddirection_10m[i]}deg)">↑</span>
            </div>
        `;
        container.appendChild(div);
    }
}

function displayDailyForecast(data) {
    const container = document.getElementById('daily-container');
    container.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const date = new Date(data.daily.time[i]);
        const sunrise = new Date(data.daily.sunrise[i]);
        const sunset = new Date(data.daily.sunset[i]);
        
        const div = document.createElement('div');
        div.className = 'forecast-item';
        div.innerHTML = `
            <div class="date">
                <div>${formatDate(date)}</div>
            </div>
            <div class="temp-range">
                <span class="max">${Math.round(data.daily.temperature_2m_max[i])}°</span>
                <span class="min">${Math.round(data.daily.temperature_2m_min[i])}°</span>
            </div>
            <div class="weather-icon">${getWeatherDescription(data.daily.weathercode[i])}</div>
            <div class="precipitation">
                <span>降雨 ${data.daily.precipitation_probability_max[i]}%</span>
                <span>${data.daily.precipitation_sum[i]}mm</span>
            </div>
            <div class="wind">
                <span>最大風速 ${Math.round(data.daily.windspeed_10m_max[i])} km/h</span>
            </div>
            <div class="sun-time">
                <span>☀️ ${sunrise.toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
                <span>🌙 ${sunset.toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
        container.appendChild(div);
    }
}

// 添加自動更新
setInterval(() => {
    if (navigator.onLine) {  // 檢查網絡連接
        const position = JSON.parse(localStorage.getItem('lastPosition'));
        if (position) {
            getWeather(position.latitude, position.longitude);
        }
    }
}, 10 * 60 * 1000);  // 每10分鐘更新一次

// 保存最後一次成功的位置
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            localStorage.setItem('lastPosition', JSON.stringify({ latitude, longitude }));
            getWeather(latitude, longitude);
        },
        (error) => {
            console.error('無法獲取位置:', error);
            const defaultPosition = { latitude: 25.0330, longitude: 121.5654 };
            localStorage.setItem('lastPosition', JSON.stringify(defaultPosition));
            getWeather(defaultPosition.latitude, defaultPosition.longitude);
        }
    );
} else {
    console.error('瀏覽器不支持地理位置功能');
    getWeather(25.0330, 121.5654);
} 