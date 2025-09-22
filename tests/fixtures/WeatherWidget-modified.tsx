import React, { useState, useEffect, useCallback } from 'react';

interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed?: number;
  pressure?: number;
}

interface WeatherWidgetProps {
  city?: string;
  unit?: 'celsius' | 'fahrenheit';
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  city = 'New York',
  unit = 'celsius',
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weather?city=${city}&unit=${unit}`);
      const data = await response.json();
      setWeather(data);
    } catch (err) {
      setError('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  }, [city, unit]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const convertTemperature = (temp: number): string => {
    if (unit === 'fahrenheit') {
      return `${Math.round((temp * 9) / 5 + 32)}°F`;
    }
    return `${temp}°C`;
  };

  const handleRefresh = () => {
    fetchWeather();
  };

  return (
    <div className="weather-widget">
      <div className="widget-header">
        <h3>Weather in {city}</h3>
        <button onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      ) : weather ? (
        <div className="weather-content">
          <div className="main-info">
            <span className="temperature">{convertTemperature(weather.temperature)}</span>
            <img src={weather.icon} alt={weather.description} />
          </div>
          <p className="description">{weather.description}</p>
          <div className="details">
            <span>Humidity: {weather.humidity}%</span>
            {weather.windSpeed && <span>Wind: {weather.windSpeed} km/h</span>}
            {weather.pressure && <span>Pressure: {weather.pressure} hPa</span>}
          </div>
        </div>
      ) : (
        <p className="no-data">No weather data available</p>
      )}
    </div>
  );
};
