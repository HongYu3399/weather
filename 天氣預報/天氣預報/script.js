let locationData = null;

// 添加緩存控制
const CACHE_DURATION = 10 * 60 * 1000; // 10分鐘緩存
let weatherCache = {
    data: null,
    timestamp: null
};

// 添加新的 API 端點
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// 在文件開頭添加新的常量
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const searchInput = document.getElementById('location-search');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');

// 添加防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

async function getWeatherAndAirQuality(lat, lon) {
    try {
        // 清除緩存，確保獲取新數據
        weatherCache.data = null;
        weatherCache.timestamp = null;

        // 顯示載入動畫
        document.getElementById('loading-spinner').style.display = 'block';
        document.querySelector('.current-weather').style.display = 'none';
        document.querySelector('.hourly-forecast').style.display = 'none';
        document.querySelector('.daily-forecast').style.display = 'none';

        // 同時請求天氣、空氣品質和地理位置數據
        const [weatherResponse, airQualityResponse, locationResponse] = await Promise.all([
            fetch(`${WEATHER_API}?` +
                `latitude=${lat}&longitude=${lon}` +
                `&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation_probability,` +
                `weathercode,windspeed_10m,winddirection_10m,uv_index,pressure_msl` +
                `&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,` +
                `precipitation_sum,precipitation_probability_max,windspeed_10m_max,uv_index_max` +
                `&current_weather=true` +
                `&timezone=Asia%2FTaipei`
            ),
            fetch(`${AIR_QUALITY_API}?` +
                `latitude=${lat}&longitude=${lon}` +
                `&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,european_aqi` +
                `&timezone=Asia%2FTaipei`
            ),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        ]);

        const [weatherData, airQualityData, locationData] = await Promise.all([
            weatherResponse.json(),
            airQualityResponse.json(),
            locationResponse.json()
        ]);

        // 合併數據
        const combinedData = {
            weatherData,
            airQualityData,
            locationData
        };

        // 更新緩存
        weatherCache.data = combinedData;
        weatherCache.timestamp = Date.now();

        // 處理並顯示數據
        handleWeatherData(combinedData);
    } catch (error) {
        console.error('獲取天氣數據失敗:', error);
        handleError(error);
    }
}

function handleWeatherData(combinedData) {
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
    const locationName = combinedData.locationData.address.city || 
                        combinedData.locationData.address.town || 
                        combinedData.locationData.address.county || 
                        '未知位置';
    document.getElementById('location').textContent = locationName;
    document.getElementById('current-date').textContent = formatDate(new Date());

    // 顯示天氣數據
    displayCurrentWeather(combinedData.weatherData);
    displayHourlyForecast(combinedData.weatherData.hourly);
    displayDailyForecast(combinedData.weatherData);
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

// 在顯示天氣數據時調用分析功能
function displayCurrentWeather(weatherData) {
    const currentTemp = document.getElementById('current-temp');
    const currentDesc = document.getElementById('current-desc');
    const currentDetails = document.getElementById('current-details');
    
    currentTemp.innerHTML = `${Math.round(weatherData.current_weather.temperature)}°C`;
    currentDesc.innerHTML = getWeatherDescription(weatherData.current_weather.weathercode);
    
    // 獲取當前小時的詳細數據
    const currentHourIndex = weatherData.hourly.time.findIndex(time => 
        new Date(time).getHours() === new Date().getHours()
    );

    currentDetails.innerHTML = `
        <div class="weather-detail">
            <span>體感溫度</span>
            <span>${Math.round(weatherData.hourly.apparent_temperature[currentHourIndex])}°C</span>
        </div>
        <div class="weather-detail">
            <span>濕度</span>
            <span>${weatherData.hourly.relativehumidity_2m[currentHourIndex]}%</span>
        </div>
        <div class="weather-detail">
            <span>降雨機率</span>
            <span>${weatherData.hourly.precipitation_probability[currentHourIndex]}%</span>
        </div>
        <div class="weather-detail">
            <span>風速</span>
            <span>${weatherData.hourly.windspeed_10m[currentHourIndex]} km/h</span>
        </div>
        <div class="weather-detail">
            <span>日出</span>
            <span>${new Date(weatherData.daily.sunrise[0]).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="weather-detail">
            <span>日落</span>
            <span>${new Date(weatherData.daily.sunset[0]).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
    `;

    // 添加天氣分析
    const currentHour = new Date().getHours();
    const analysisContent = document.getElementById('weather-analysis-content');
    
    // 獲取分析數據
    const temp = weatherData.hourly.temperature_2m[currentHour];
    const humidity = weatherData.hourly.relativehumidity_2m[currentHour];
    const rainProb = weatherData.hourly.precipitation_probability[currentHour];
    const uv = weatherData.hourly.uv_index[currentHour];
    const pressure = weatherData.hourly.pressure_msl[currentHour];

    // 獲取空氣品質數據
    const airQuality = weatherCache.data.airQualityData.hourly;
    const aqi = airQuality.european_aqi[currentHour];
    const pm25 = airQuality.pm2_5[currentHour];
    const pm10 = airQuality.pm10[currentHour];

    // 計算各項趨勢
    const tempTrend = getTempTrend(weatherData.hourly.temperature_2m);
    const rainTrendText = getRainTrend(rainProb);
    const comfortLevel = calculateComfort(temp, humidity);
    const uvLevel = getUVLevel(uv);
    const pressureTrend = getPressureTrend(pressure);
    
    // 生成分析 HTML
    analysisContent.innerHTML = `
        <div class="weather-suggestion">
            <h4>綜合天氣建議：</h4>
            <p class="suggestion-text">天氣提醒：
• ${generateSuggestion(tempTrend, rainTrendText, comfortLevel, uvLevel, aqi)}</p>
        </div>

        <div class="analysis-section">
            <div class="analysis-item">
                <span class="analysis-label">溫度趨勢</span>
                <span class="analysis-value">${tempTrend}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">降雨趨勢</span>
                <span class="analysis-value">${rainTrendText}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">舒適度</span>
                <span class="analysis-value">${comfortLevel}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">UV指數</span>
                <span class="analysis-value">${uvLevel} (${uv})</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">氣壓趨勢</span>
                <span class="analysis-value">${pressureTrend}</span>
            </div>
        </div>

        <div class="air-quality-section">
            <h4>空氣品質指標 (AQI)</h4>
            <div class="aqi-progress">
                <div class="progress-bar">
                    <div class="progress-value ${getAQIClass(aqi)}" 
                         style="width: ${getAQIWidth(aqi)}%">
                    </div>
                    <div class="aqi-value">${aqi}</div>
                </div>
            </div>
            <div class="aqi-labels">
                <span>優良</span>
                <span>中等</span>
                <span>不佳</span>
                <span>危險</span>
            </div>

            <div class="pm-item">
                <div class="pm-header">
                    <span class="pm-label">PM2.5</span>
                    <span class="pm-value">${pm25.toFixed(1)} μg/m³</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-value ${getPM25Class(pm25)}" 
                         style="width: ${getPMWidth(pm25, 150)}%">
                    </div>
                </div>
            </div>

            <div class="pm-item">
                <div class="pm-header">
                    <span class="pm-label">PM10</span>
                    <span class="pm-value">${pm10.toFixed(1)} μg/m³</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-value ${getPM10Class(pm10)}" 
                         style="width: ${getPMWidth(pm10, 300)}%">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 計算 AQI 進度條寬度
function getAQIWidth(aqi) {
    return Math.min((aqi / 300) * 100, 100);
}

// 生成綜合天氣建議
function generateWeatherSuggestion(tempTrend, rainTrend, comfort, uvLevel) {
    let suggestions = ['天氣提醒：'];

    // 根據舒適度和天氣狀況給出建議
    switch (comfort) {
        case "涼爽":
            suggestions.push("• 天氣涼爽，適合戶外活動");
            break;
        case "舒適":
            suggestions.push("• 天氣舒適宜人，適合外出");
            break;
        case "悶熱":
            suggestions.push("• 天氣較悶熱，請注意補充水分");
            break;
        case "炎熱":
            suggestions.push("• 天氣炎熱，建議避免長時間戶外活動");
            break;
    }

    // 根據降雨趨勢給出建議
    if (rainTrend === "降雨機率高") {
        suggestions.push("• 請記得攜帶雨具");
    }

    // 根據 UV 指數給出建議
    if (uvLevel !== "低量") {
        suggestions.push("• 請注意防曬");
    }

    return suggestions.join('\n');
}

// 計算溫度趨勢
function getTempTrend(temps) {
    const now = temps[new Date().getHours()];
    const later = temps[new Date().getHours() + 3] || temps[0];
    const diff = later - now;
    if (Math.abs(diff) < 1) return "穩定";
    return diff > 0 ? "上升" : "下降";
}

// 判斷降雨趨勢
function getRainTrend(prob) {
    if (prob >= 70) return "降雨機率高";
    if (prob >= 30) return "可能降雨";
    return "降雨機率低";
}

// 計算舒適度
function calculateComfort(temp, humidity) {
    if (temp < 16) return "涼爽";
    if (temp > 28 && humidity > 70) return "悶熱";
    if (temp > 30) return "炎熱";
    return "舒適";
}

// 獲取 UV 等級
function getUVLevel(uv) {
    if (uv <= 2) return "低量";
    if (uv <= 5) return "中量";
    if (uv <= 7) return "高量";
    return "過量";
}

// 判斷氣壓趨勢
function getPressureTrend(pressure) {
    if (pressure > 1013.25) return "高壓";
    if (pressure < 1013.25) return "低壓";
    return "正常";
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
            getWeatherAndAirQuality(position.latitude, position.longitude);
        }
    }
}, 10 * 60 * 1000);  // 每10分鐘更新一次

// 保存最後一次成功的位置
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            localStorage.setItem('lastPosition', JSON.stringify({ latitude, longitude }));
            getWeatherAndAirQuality(latitude, longitude);
        },
        (error) => {
            console.error('無法獲取位置:', error);
            const defaultPosition = { latitude: 25.0330, longitude: 121.5654 };
            localStorage.setItem('lastPosition', JSON.stringify(defaultPosition));
            getWeatherAndAirQuality(defaultPosition.latitude, defaultPosition.longitude);
        }
    );
} else {
    console.error('瀏覽器不支持地理位置功能');
    getWeatherAndAirQuality(25.0330, 121.5654);
}

// 修改搜尋地點函數
async function searchLocation(query) {
    try {
        const response = await fetch(
            // 移除 countrycodes 參數，允許搜尋全球地點
            `${NOMINATIM_API}?format=json&q=${encodeURIComponent(query)}&limit=10`
        );
        const data = await response.json();
        displaySearchResults(data);
    } catch (error) {
        console.error('搜尋地點失敗:', error);
    }
}

// 修改顯示搜尋結果的函數
function displaySearchResults(results) {
    searchResults.innerHTML = '';
    if (results.length === 0) {
        searchResults.style.display = 'none';
        return;
    }

    // 優化地點過濾邏輯
    const filteredResults = results
        .map(result => {
            const address = result.address || {};
            let name;

            // 優先順序：縣市 > 鄉鎮市區
            if (address.city) {
                name = address.city;
            } else if (address.county) {
                name = address.county;
            } else if (address.town || address.district) {
                // 如果有縣市資訊，加上縣市名
                const cityName = address.city || address.county || '';
                const townName = address.town || address.district;
                name = cityName ? `${cityName}${townName}` : townName;
            } else {
                // 如果都沒有，使用顯示名稱，但過濾掉含有特定字詞的結果
                name = result.display_name.split(',')[0];
            }

            return {
                name: name,
                lat: result.lat,
                lon: result.lon,
                type: result.type,
                importance: result.importance
            };
        })
        // 過濾掉不需要的地點類型
        .filter(result => 
            !result.name.includes('路') && 
            !result.name.includes('街') &&
            !result.name.includes('巷') &&
            result.type !== 'house' &&
            result.type !== 'building'
        )
        // 移除重複的地名
        .filter((result, index, self) => 
            index === self.findIndex((t) => t.name === result.name)
        )
        // 根據重要性排序
        .sort((a, b) => b.importance - a.importance)
        // 只取前5個結果
        .slice(0, 5);

    // 為每個結果獲取溫度
    filteredResults.forEach(async result => {
        try {
            const response = await fetch(
                `${WEATHER_API}?latitude=${result.lat}&longitude=${result.lon}&current_weather=true&timezone=Asia%2FTaipei`
            );
            const data = await response.json();
            const temp = Math.round(data.current_weather.temperature);

            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span class="location-name">${result.name}</span>
                <span class="location-temp">${temp}°C</span>
            `;
            div.addEventListener('click', () => {
                selectLocation({
                    lat: result.lat,
                    lon: result.lon,
                    name: result.name
                });
                searchResults.style.display = 'none';
                searchInput.value = result.name;
            });
            searchResults.appendChild(div);
        } catch (error) {
            console.error('獲取溫度失敗:', error);
        }
    });

    searchResults.style.display = 'block';
}

// 選擇地點
function selectLocation(location) {
    console.log('選擇位置:', location); // 添加調試日誌
    getWeatherAndAirQuality(parseFloat(location.lat), parseFloat(location.lon));
}

// 添加事件監聽器
searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim();
    if (query.length >= 2) {
        searchLocation(query);
    } else {
        searchResults.style.display = 'none';
    }
}, 500));

searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
        searchLocation(query);
    }
});

// 點擊其他地方時隱藏搜尋結果
document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
        searchResults.style.display = 'none';
    }
});

// 按下 Enter 鍵時觸發搜尋
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchLocation(query);
        }
    }
});

// 添加以下輔助函數
function getAQIClass(aqi) {
    if (aqi <= 50) return 'level-good';
    if (aqi <= 100) return 'level-moderate';
    if (aqi <= 150) return 'level-unhealthy';
    return 'level-dangerous';
}

function getPM25Class(pm25) {
    if (pm25 <= 12) return 'level-good';
    if (pm25 <= 35.4) return 'level-moderate';
    if (pm25 <= 55.4) return 'level-unhealthy';
    return 'level-dangerous';
}

function getPM10Class(pm10) {
    if (pm10 <= 54) return 'level-good';
    if (pm10 <= 154) return 'level-moderate';
    if (pm10 <= 254) return 'level-unhealthy';
    return 'level-dangerous';
}

function getPMWidth(value, max) {
    return (value / max) * 100;
}

// 添加生成建議的函數
function generateSuggestion(tempTrend, rainTrend, comfort, uvLevel, aqi) {
    let suggestions = [];

    // 根據舒適度給出建議
    switch (comfort) {
        case "涼爽":
            suggestions.push("天氣涼爽，適合戶外活動");
            break;
        case "舒適":
            suggestions.push("天氣舒適宜人，適合外出");
            break;
        case "悶熱":
            suggestions.push("天氣較悶熱，請注意補充水分");
            break;
        case "炎熱":
            suggestions.push("天氣炎熱，建議避免長時間戶外活動");
            break;
    }

    // 根據降雨趨勢給出建議
    if (rainTrend === "降雨機率高") {
        suggestions.push("請記得攜帶雨具");
    }

    // 根據 UV 指數給出建議
    if (uvLevel !== "低量") {
        suggestions.push("請注意防曬");
    }

    // 根據空氣品質給出建議
    if (aqi > 100) {
        suggestions.push("空氣品質不佳，建議戴口罩");
    }

    return suggestions.join('\n• ');
} 