// App.js
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

function App() {
    const [sensorData, setSensorData] = useState([]);
    const [isAnomaly, setIsAnomaly] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            fetch("http://localhost:8005/data") // Endpoint que retorna os dados do sensor
                .then(res => res.json())
                .then(data => {
                    setSensorData(prev => [...prev.slice(-19), data]);
                    setIsAnomaly(data.anomaly);
                });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const chartData = {
        labels: sensorData.map((_, i) => i),
        datasets: [
            {
                label: 'Aceleração Total (g)',
                data: sensorData.map(d => d.acceleration),
                fill: false,
                borderColor: 'blue',
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5
            }
        ]
    };

    return (
        <div style={{
            height: '100vh',
            backgroundColor: isAnomaly ? '#ff4d4f' : '#f0f2f5',
            transition: 'background-color 0.5s ease',
            padding: '2rem'
        }}>
            <h1>Monitoramento de Tremores</h1>
            <Line
                data={chartData}
                options={{
                    animation: false,
                    scales: {
                        x: {
                            type: 'linear',
                            title: { display: true, text: 'Tempo (amostras)' },
                            ticks: { stepSize: 1 }
                        },
                        y: {
                            title: { display: true, text: 'Aceleração Total (g)' }
                        }
                    },
                    plugins: {
                        legend: { display: true },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    elements: {
                        line: { tension: 0.3 },
                        point: { radius: 2, hoverRadius: 5 }
                    }
                }}
            />
            {isAnomaly && <h2 style={{ color: 'white' }}>⚠️ Anomalia Detectada: Possível Tremor</h2>}
        </div>
    );
}

export default App;
