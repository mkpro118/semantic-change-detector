import React, { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  icon: string;
}

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="weather-widget">
      <h3>Weather</h3>
      {loading ? (
        <p>Loading...</p>
      ) : weather ? (
        <div>
          <p>{weather.temperature}°C</p>
          <p>{weather.description}</p>
        </div>
      ) : (
        <p>No data</p>
      )}
    </div>
  );
};
