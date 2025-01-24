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
        if (weatherCache.data && weatherCache.timestamp && 
            (Date.now() - weatherCache.timestamp < CACHE_DURATION)) {
            return handleWeatherData(weatherCache.data);
        }

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

        return handleWeatherData(combinedData);
    } catch (error) {
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

// 添加天氣趨勢分析功能
function analyzeWeatherTrend(weatherData, airQualityData) {
    const hourlyData = weatherData.hourly;
    const temperatures = hourlyData.temperature_2m;
    const humidity = hourlyData.relativehumidity_2m;
    const precipitation = hourlyData.precipitation_probability;
    const uvIndex = hourlyData.uv_index;
    const pressure = hourlyData.pressure_msl;

    // 基本趨勢分析
    const tempTrend = calculateTrend(temperatures.slice(0, 24));
    const rainTrend = calculatePrecipitationTrend(precipitation.slice(0, 24));
    const comfortIndex = calculateComfortIndex(temperatures[0], humidity[0]);
    
    // UV 指數分析
    const currentUV = uvIndex[new Date().getHours()];
    const uvWarning = analyzeUVIndex(currentUV);

    // 氣壓趨勢
    const pressureTrend = analyzePressureTrend(pressure.slice(0, 24));

    // 空氣品質分析
    const airQuality = analyzeAirQuality(airQualityData);

    return {
        temperatureTrend: tempTrend,
        rainProbability: rainTrend,
        comfortLevel: comfortIndex,
        uvIndex: {
            value: currentUV,
            warning: uvWarning
        },
        pressure: pressureTrend,
        airQuality,
        suggestion: generateComprehensiveSuggestion(
            tempTrend, 
            rainTrend, 
            comfortIndex, 
            currentUV, 
            airQuality.aqiLevel
        )
    };
}

// 計算趨勢
function calculateTrend(data) {
    const first12Hours = data.slice(0, 12);
    const second12Hours = data.slice(12, 24);
    
    const firstAvg = first12Hours.reduce((a, b) => a + b) / 12;
    const secondAvg = second12Hours.reduce((a, b) => a + b) / 12;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 2) return "上升";
    if (difference < -2) return "下降";
    return "穩定";
}

// 計算降雨趨勢
function calculatePrecipitationTrend(probabilities) {
    const maxProb = Math.max(...probabilities);
    const avgProb = probabilities.reduce((a, b) => a + b) / probabilities.length;
    
    if (maxProb >= 70) return "大幅降雨機率";
    if (maxProb >= 40) return "中等降雨機率";
    if (avgProb >= 20) return "小幅降雨機率";
    return "降雨機率低";
}

// 計算舒適度指數
function calculateComfortIndex(temp, humidity) {
    // 使用溫濕度指數(THI)
    const THI = temp - 0.55 * (1 - humidity/100) * (temp - 14.5);
    
    if (THI <= 15) return "寒冷";
    if (THI <= 20) return "涼爽";
    if (THI <= 26) return "舒適";
    if (THI <= 30) return "悶熱";
    return "炎熱";
}

// 分析 UV 指數
function analyzeUVIndex(uv) {
    if (uv <= 2) return "低量";
    if (uv <= 5) return "中量";
    if (uv <= 7) return "高量";
    if (uv <= 10) return "過量";
    return "危險";
}

// 分析氣壓趨勢
function analyzePressureTrend(pressureData) {
    const change = pressureData[pressureData.length - 1] - pressureData[0];
    if (Math.abs(change) < 1) return "穩定";
    return change > 0 ? "上升" : "下降";
}

// 生成綜合建議
function generateComprehensiveSuggestion(tempTrend, rainTrend, comfort, uv, airQuality) {
    let suggestion = "綜合天氣建議：\n";
    
    // 基本天氣建議
    suggestion += generateBasicWeatherSuggestion(tempTrend, rainTrend, comfort);
    
    // UV 建議
    if (uv > 5) {
        suggestion += "• UV指數較高，請做好防曬措施\n";
    }
    
    // 空氣品質建議
    if (airQuality !== "優" && airQuality !== "良好") {
        suggestion += "• 空氣品質不佳，建議戴口罩外出\n";
    }
    
    return suggestion;
}

// 生成基本天氣建議
function generateBasicWeatherSuggestion(tempTrend, rainTrend, comfort) {
    let suggestion = "天氣提醒：\n";
    
    // 根據溫度趨勢
    if (tempTrend === "上升") {
        suggestion += "• 溫度將逐漸升高，請注意防曬降溫\n";
    } else if (tempTrend === "下降") {
        suggestion += "• 溫度將逐漸下降，請適時添加衣物\n";
    }
    
    // 根據降雨趨勢
    if (rainTrend.includes("大幅")) {
        suggestion += "• 預計有較大降雨，請攜帶雨具\n";
    } else if (rainTrend.includes("中等")) {
        suggestion += "• 可能會下雨，建議備好雨具\n";
    }
    
    // 根據舒適度
    switch (comfort) {
        case "寒冷":
            suggestion += "• 天氣寒冷，請注意保暖\n";
            break;
        case "涼爽":
            suggestion += "• 天氣涼爽，適合戶外活動\n";
            break;
        case "舒適":
            suggestion += "• 天氣舒適宜人\n";
            break;
        case "悶熱":
            suggestion += "• 天氣較悶熱，注意補充水分\n";
            break;
        case "炎熱":
            suggestion += "• 天氣炎熱，請避免長時間戶外活動\n";
            break;
    }
    
    return suggestion;
}

// 添加空氣品質分析
function analyzeAirQuality(airQualityData) {
    const currentHour = new Date().getHours();
    const aqi = airQualityData.hourly.european_aqi[currentHour];
    const pm25 = airQualityData.hourly.pm2_5[currentHour];
    const pm10 = airQualityData.hourly.pm10[currentHour];
    
    let aqiLevel;
    if (aqi <= 50) aqiLevel = "優";
    else if (aqi <= 100) aqiLevel = "良好";
    else if (aqi <= 150) aqiLevel = "輕度污染";
    else if (aqi <= 200) aqiLevel = "中度污染";
    else aqiLevel = "重度污染";

    return {
        aqi,
        aqiLevel,
        pm25,
        pm10,
        suggestion: generateAirQualitySuggestion(aqi)
    };
}

// 生成空氣品質建議
function generateAirQualitySuggestion(aqi) {
    if (aqi <= 50) {
        return "空氣品質優良，適合戶外活動";
    } else if (aqi <= 100) {
        return "空氣品質尚可，敏感人群應減少戶外活動";
    } else if (aqi <= 150) {
        return "空氣品質不佳，建議戴口罩外出";
    } else {
        return "空氣品質差，建議避免戶外活動";
    }
}

// 修改空氣品質顯示部分
function getAQIColor(aqi) {
    if (aqi <= 50) return 'aqi-excellent';
    if (aqi <= 100) return 'aqi-good';
    if (aqi <= 150) return 'aqi-moderate';
    if (aqi <= 200) return 'aqi-poor';
    return 'aqi-very-poor';
}

function getAQIWidth(aqi) {
    // 將 AQI 值轉換為 0-100% 的寬度
    return Math.min(Math.max((aqi / 300) * 100, 0), 100);
}

// 添加 PM2.5 和 PM10 的處理函數
function getPM25Color(pm25) {
    if (pm25 <= 12) return 'pm-good';
    if (pm25 <= 35.4) return 'pm-moderate';
    if (pm25 <= 55.4) return 'pm-unhealthy';
    return 'pm-very-unhealthy';
}

function getPM10Color(pm10) {
    if (pm10 <= 54) return 'pm-good';
    if (pm10 <= 154) return 'pm-moderate';
    if (pm10 <= 254) return 'pm-unhealthy';
    return 'pm-very-unhealthy';
}

function getPMWidth(value, max) {
    return Math.min(Math.max((value / max) * 100, 0), 100);
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

    // 添加空氣品質和 UV 指數顯示
    const analysis = analyzeWeatherTrend(weatherData, weatherCache.data.airQualityData);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.className = 'weather-analysis';
    analysisDiv.innerHTML = `
        <h3>天氣分析</h3>
        <div class="analysis-details">
            <p>溫度趨勢：${analysis.temperatureTrend}</p>
            <p>降雨趨勢：${analysis.rainProbability}</p>
            <p>舒適度：${analysis.comfortLevel}</p>
            <p>UV指數：${analysis.uvIndex.value} (${analysis.uvIndex.warning})</p>
            <p>氣壓趨勢：${analysis.pressure}</p>
            
            <div class="air-quality-section">
                <p>空氣品質指標 (AQI)</p>
                <div class="aqi-progress">
                    <div class="aqi-bar ${getAQIColor(analysis.airQuality.aqi)}" 
                         style="width: ${getAQIWidth(analysis.airQuality.aqi)}%">
                    </div>
                    <div class="aqi-marker" style="left: ${getAQIWidth(analysis.airQuality.aqi)}%"></div>
                    <div class="aqi-value">${analysis.airQuality.aqi}</div>
                </div>
                <div class="aqi-labels">
                    <span>優良</span>
                    <span>中等</span>
                    <span>不佳</span>
                    <span>危險</span>
                </div>

                <p>PM2.5</p>
                <div class="pm-progress">
                    <div class="pm-bar ${getPM25Color(analysis.airQuality.pm25)}" 
                         style="width: ${getPMWidth(analysis.airQuality.pm25, 150)}%">
                    </div>
                    <div class="pm-value">${analysis.airQuality.pm25} μg/m³</div>
                </div>

                <p>PM10</p>
                <div class="pm-progress">
                    <div class="pm-bar ${getPM10Color(analysis.airQuality.pm10)}" 
                         style="width: ${getPMWidth(analysis.airQuality.pm10, 300)}%">
                    </div>
                    <div class="pm-value">${analysis.airQuality.pm10} μg/m³</div>
                </div>
            </div>
        </div>
        <div class="weather-suggestion">
            ${analysis.suggestion.split('\n').map(line => 
                line ? `<p>${line}</p>` : ''
            ).join('')}
        </div>
    `;
    
    document.querySelector('.current-weather').appendChild(analysisDiv);
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