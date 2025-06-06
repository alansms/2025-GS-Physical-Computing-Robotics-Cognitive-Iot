// App.js
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

// URLs de conexão
const API_URL = "http://localhost:8081";  // URL do servidor local

function App() {
    const [sensorData, setSensorData] = useState([]);
    const [isAnomaly, setIsAnomaly] = useState(false);
    // Ajustando threshold inicial para um valor mais adequado aos dados do sensor
    const [alarmThreshold, setAlarmThreshold] = useState(0.01);
    const [connectionError, setConnectionError] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureStatus, setCaptureStatus] = useState({ normal_samples: 0, anomaly_samples: 0, ready_for_training: false });
    const [trainingStatus, setTrainingStatus] = useState(null);
    const [sensorOnline, setSensorOnline] = useState(false);
    const [lastDataReceived, setLastDataReceived] = useState(null);
    const [sensorInfo, setSensorInfo] = useState(null);
    const [visibleAxes, setVisibleAxes] = useState({
        combined: true,
        x: true,
        y: true
    });
    const [rawData, setRawData] = useState([]);
    const [currentModel, setCurrentModel] = useState(null);

    const chartData = {
        labels: sensorData.map((_, i) => i),
        datasets: [
            {
                label: 'Aceleração X-Y (g)',
                data: sensorData.map(d => d.acceleration_xy),
                fill: false,
                borderColor: isAnomaly ? 'red' : 'blue',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2,
            },
            {
                label: 'Aceleração X',
                data: sensorData.map(d => d.ax),
                fill: false,
                borderColor: 'green',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 1,
            },
            {
                label: 'Aceleração Y',
                data: sensorData.map(d => d.ay),
                fill: false,
                borderColor: 'orange',
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 1,
            }
        ]
    };

    // Filtrar datasets baseado nos eixos visíveis
    const filteredDatasets = chartData.datasets.filter(dataset => {
        if (dataset.label === 'Aceleração X-Y (g)') return visibleAxes.combined;
        if (dataset.label === 'Aceleração X') return visibleAxes.x;
        if (dataset.label === 'Aceleração Y') return visibleAxes.y;
        return true;
    }) || [];

    // Adicionar verificação do servidor na inicialização
    useEffect(() => {
        const checkServer = async () => {
            setConnectionError(false);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // timeout de 5s

                const response = await fetch(`${API_URL}/status`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`Conexão bem sucedida com ${API_URL}:`, data);
                    setSensorInfo(data);
                    setSensorOnline(true);
                    setConnectionError(false);
                } else {
                    throw new Error(`Status ${response.status}`);
                }
            } catch (error) {
                console.error(`Erro ao conectar em ${API_URL}:`, error.message);
                setSensorOnline(false);
                setConnectionError(true);
                setSensorInfo(null);
                console.error("Não foi possível conectar ao servidor local na porta 8080");
            }
        };

        // Executar verificação inicial
        checkServer();

        // Configurar verificação periódica a cada 30 segundos
        const interval = setInterval(checkServer, 30000);

        return () => clearInterval(interval);
    }, []);

    // Monitorar tempo desde último dado recebido
    useEffect(() => {
        let checkInterval;
        if (isMonitoring) {
            checkInterval = setInterval(() => {
                if (lastDataReceived) {
                    const timeSinceLastData = Date.now() - lastDataReceived;
                    if (timeSinceLastData > 5000) {
                        setSensorOnline(false);
                    }
                }
            }, 1000);
        }
        return () => {
            if (checkInterval) clearInterval(checkInterval);
        };
    }, [isMonitoring, lastDataReceived]);

    // Modificar o useEffect de fetchData para maior responsividade
    useEffect(() => {
        let intervalId;

        if (isMonitoring) {
            const fetchData = async () => {
                try {
                    const response = await fetch(`${API_URL}/data`);

                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }

                    const data = await response.json();

                    // Calculando magnitude da aceleração combinada com maior sensibilidade
                    const acceleration_xy = Math.sqrt(
                        Math.pow(data.ax || 0, 2) +
                        Math.pow(data.ay || 0, 2)
                    );

                    // Atualizando o objeto de dados com a magnitude calculada
                    const processedData = {
                        ...data,
                        acceleration_xy,
                        timestamp: Date.now()
                    };

                    setLastDataReceived(Date.now());
                    setSensorOnline(true);

                    // Atualizar dados mantendo mais pontos no gráfico para melhor visualização
                    setSensorData(prev => [...prev.slice(-49), processedData]);

                    const isAboveThreshold = acceleration_xy >= alarmThreshold;
                    setIsAnomaly(isAboveThreshold);
                    setConnectionError(false);

                    // Atualizar dados brutos com mais precisão
                    setRawData(prev => [...prev.slice(-9), {
                        timestamp: Date.now(),
                        x: data.ax.toFixed(6),
                        y: data.ay.toFixed(6),
                        combined: acceleration_xy.toFixed(6)
                    }]);

                    if (isAboveThreshold) {
                        showAnomalyAlert(processedData);
                    }
                } catch (error) {
                    console.error("Error fetching data:", error);
                    setConnectionError(true);
                    setSensorOnline(false);
                }
            };

            // Aumentar a frequência de atualização para 100ms
            fetchData();
            intervalId = setInterval(fetchData, 100);
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isMonitoring, alarmThreshold]);

    // Adicionar novo useEffect para monitorar status da captura
    useEffect(() => {
        let statusInterval;
        if (isCapturing) {
            const checkStatus = async () => {
                try {
                    const response = await fetch(`${API_URL}/capture-status`);
                    const status = await response.json();
                    setCaptureStatus(status);
                } catch (error) {
                    console.error("Erro ao verificar status da captura:", error);
                }
            };
            checkStatus();
            statusInterval = setInterval(checkStatus, 5000);
        }
        return () => {
            if (statusInterval) clearInterval(statusInterval);
        };
    }, [isCapturing]);

    const startCapture = async () => {
        try {
            const response = await fetch(`${API_URL}/start-capture`, {
                method: 'POST'
            });
            const data = await response.json();
            setIsCapturing(true);
            setIsMonitoring(true);
            alert(data.message);
        } catch (error) {
            alert("Erro ao iniciar captura: " + error.message);
        }
    };

    const stopCapture = async () => {
        try {
            const response = await fetch(`${API_URL}/stop-capture`, {
                method: 'POST'
            });
            const data = await response.json();
            setIsCapturing(false);
            setIsMonitoring(false);
            alert(data.message);
        } catch (error) {
            alert("Erro ao parar captura: " + error.message);
        }
    };

    // Função para solicitar nome do modelo
    const requestModelName = () => {
        const name = prompt("Digite um nome para identificar este modelo (ex: Motor VW Golf):");
        if (name) return name;
        return null;
    };

    // Função para mostrar alerta de anomalia
    const showAnomalyAlert = (data) => {
        const modelInfo = currentModel ? `Modelo: ${currentModel.name}` : "Modelo padrão";
        const message = `⚠️ ALERTA DE ANOMALIA DETECTADA!\n\n${modelInfo}\n\nValores detectados:\nAceleração X: ${data.ax.toFixed(3)}\nAceleração Y: ${data.ay.toFixed(3)}\nAceleração Total: ${data.acceleration_xy.toFixed(3)}`;

        // Criar elemento de alerta personalizado
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ff4d4f;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.5s ease-out;
        `;
        alertDiv.innerHTML = message.replace(/\n/g, '<br>');

        document.body.appendChild(alertDiv);

        // Remover alerta após 5 segundos
        setTimeout(() => {
            alertDiv.style.animation = 'slideOut 0.5s ease-in';
            setTimeout(() => alertDiv.remove(), 500);
        }, 5000);
    };

    const startTraining = async () => {
        if (!captureStatus.ready_for_training) {
            alert("Aguarde coletar no mínimo 30 amostras de cada tipo");
            return;
        }

        try {
            const modelName = requestModelName();
            if (!modelName) {
                alert("É necessário fornecer um nome para o modelo!");
                return;
            }

            setTrainingStatus("Treinando modelo...");
            const response = await fetch(`${API_URL}/train-model?model_name=${encodeURIComponent(modelName)}`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Erro no servidor: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.model_info) {
                throw new Error("Resposta inválida do servidor");
            }

            setCurrentModel(data.model_info);
            setTrainingStatus(`Modelo "${modelName}" treinado com sucesso!\nAcurácia média: ${(data.model_info.mean_score * 100).toFixed(2)}%`);
            setIsCapturing(false);

            // Mostrar informações sobre o código gerado para ESP32
            if (data.esp32_code) {
                alert(`Código para ESP32 gerado com sucesso!\nArquivo: ${data.esp32_code}\nO arquivo foi salvo na pasta esp32/`);
            }
        } catch (error) {
            console.error("Erro no treinamento:", error);
            setTrainingStatus(`Erro no treinamento: ${error.message}`);
        }
    };

    // Configurações melhoradas do gráfico
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0 // Desabilita animações para maior responsividade
        },
        plugins: {
            annotation: {
                annotations: {
                    threshold: {
                        type: 'line',
                        yMin: alarmThreshold,
                        yMax: alarmThreshold,
                        borderColor: 'red',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        label: {
                            content: 'Threshold',
                            enabled: true,
                            position: 'end'
                        }
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                suggestedMax: Math.max(0.1, alarmThreshold * 1.5),
                ticks: {
                    maxTicksLimit: 10,
                }
            },
            x: {
                ticks: {
                    maxTicksLimit: 10,
                    callback: function(value) {
                        return Math.round(value * 100) / 100;
                    }
                }
            }
        }
    };

    return (
        <div style={{
            height: '100vh',
            backgroundColor: connectionError ? '#fafafa' : (isAnomaly ? '#ff4d4f' : '#f0f2f5'),
            transition: 'background-color 0.5s ease',
            padding: '2rem',
            position: 'relative'
        }}>
            <h1>Monitoramento de Tremores</h1>

            {/* Informações do Modelo Atual */}
            {currentModel && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    border: '1px solid #52c41a'
                }}>
                    <h3>Modelo Atual: {currentModel.name}</h3>
                    <p>Criado em: {currentModel.created_at}</p>
                    <p>Amostras utilizadas: {currentModel.normal_samples} normais, {currentModel.anomaly_samples} anomalias</p>
                    <p>Acurácia: {(currentModel.mean_score * 100).toFixed(2)}%</p>
                </div>
            )}

            {/* Status do Sensor e controles */}
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                {/* Status do Sensor */}
                <div style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: sensorOnline ? '#f6ffed' : '#fff2f0',
                    border: `1px solid ${sensorOnline ? '#b7eb8f' : '#ffccc7'}`,
                    borderRadius: '4px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: sensorOnline ? '#52c41a' : '#ff4d4f',
                            boxShadow: `0 0 8px ${sensorOnline ? '#52c41a' : '#ff4d4f'}`,
                        }} />
                        <span style={{
                            color: sensorOnline ? '#389e0d' : '#cf1322',
                            fontWeight: 'bold'
                        }}>
                            Sensor {sensorOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    {sensorInfo && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1.5rem' }}>
                            <p style={{ margin: '0.2rem 0' }}>Hostname: {sensorInfo.sensor_hostname}</p>
                            <p style={{ margin: '0.2rem 0' }}>IP: {sensorInfo.sensor_ip || 'N/A'}</p>
                        </div>
                    )}
                    {sensorOnline && lastDataReceived && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1.5rem' }}>
                            Último dado: {new Date(lastDataReceived).toLocaleTimeString()}
                        </div>
                    )}
                </div>

                {/* Monitor de Dados Brutos */}
                <div style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: 'white',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontFamily: 'monospace'
                }}>
                    <h3>Monitor de Dados</h3>
                    {rawData.map((sample, index) => (
                        <div key={sample.timestamp} style={{
                            fontSize: '0.9em',
                            marginBottom: '0.5rem',
                            color: sample.combined > alarmThreshold ? 'red' : 'inherit'
                        }}>
                            Sample {index}: X:{sample.x} Y:{sample.y} XY:{sample.combined}
                        </div>
                    ))}
                </div>
            </div>

            {/* Controles */}
            <div style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
            }}>
                <button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: isMonitoring ? '#ff4d4f' : '#52c41a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isMonitoring ? 'Parar Monitoramento' : 'Iniciar Monitoramento'}
                </button>

                <button
                    onClick={isCapturing ? stopCapture : startCapture}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: isCapturing ? '#ff4d4f' : '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isCapturing ? 'Parar Captura' : 'Iniciar Captura de Dados'}
                </button>

                {/* Botão de Treinamento */}
                <button
                    onClick={startTraining}
                    disabled={!captureStatus.ready_for_training || !isCapturing}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: (captureStatus.ready_for_training && isCapturing) ? '#722ed1' : '#d9d9d9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (captureStatus.ready_for_training && isCapturing) ? 'pointer' : 'not-allowed'
                    }}
                >
                    Treinar Modelo
                </button>

                {/* Controles de Visualização */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.5rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px'
                }}>
                    <label style={{ fontWeight: 'bold' }}>Visualizar:</label>
                    <label>
                        <input
                            type="checkbox"
                            checked={visibleAxes.combined}
                            onChange={e => setVisibleAxes(prev => ({
                                ...prev,
                                combined: e.target.checked
                            }))}
                        />
                        Combined (X-Y)
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={visibleAxes.x}
                            onChange={e => setVisibleAxes(prev => ({
                                ...prev,
                                x: e.target.checked
                            }))}
                        />
                        Eixo X
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={visibleAxes.y}
                            onChange={e => setVisibleAxes(prev => ({
                                ...prev,
                                y: e.target.checked
                            }))}
                        />
                        Eixo Y
                    </label>
                </div>

                {/* Controle de Threshold com Slider e Input Numérico */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.5rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    minWidth: '300px'
                }}>
                    <label style={{ fontWeight: 'bold' }}>
                        Threshold:
                    </label>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        flex: 1
                    }}>
                        <input
                            type="range"
                            min="0"
                            max="0.1"
                            step="0.001"
                            value={alarmThreshold}
                            onChange={(e) => setAlarmThreshold(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8em',
                            color: '#666'
                        }}>
                            <span>0</span>
                            <span>0.05</span>
                            <span>0.1</span>
                        </div>
                    </div>
                    <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={alarmThreshold}
                        onChange={(e) => setAlarmThreshold(parseFloat(e.target.value))}
                        style={{
                            width: '80px',
                            padding: '0.3rem',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px'
                        }}
                    />
                    <span style={{
                        fontSize: '0.9em',
                        color: '#666',
                        minWidth: '60px'
                    }}>
                        g (m/s²)
                    </span>
                </div>
            </div>

            {/* Gráfico com datasets filtrados */}
            <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                height: '400px'
            }}>
                <Line
                    data={{
                        ...chartData,
                        datasets: filteredDatasets
                    }}
                    options={chartOptions}
                />
            </div>

            {/* Logo FIAP - Reposicionado */}
            <img
                src="/FIAP-transparente.png"
                alt="Logo FIAP"
                style={{
                    position: 'absolute',
                    top: '5%',
                    right: '2%',
                    height: 'auto',
                    width: '13%',
                    maxWidth: '280px',
                    minWidth: '100px',
                    zIndex: 1000,
                    transform: 'translateY(-50%)'
                }}
            />

            {/* Status da Captura com informações mais detalhadas */}
            {isCapturing && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9'
                }}>
                    <h3>Status da Captura:</h3>
                    <p>Amostras Normais: {captureStatus.normal_samples} (Mínimo: 30)</p>
                    <p>Amostras de Anomalia: {captureStatus.anomaly_samples} (Mínimo: 30)</p>
                    <p>Status: {
                        captureStatus.ready_for_training
                            ? '✅ Pronto para treinar!'
                            : '⏳ Aguardando mais amostras...'
                    }</p>
                    <p style={{fontSize: '0.9em', color: '#666'}}>
                        Para gerar amostras normais, mantenha o sensor parado.
                        Para gerar amostras de anomalia, faça movimentos que simulem tremores.
                    </p>
                </div>
            )}

            {/* Status do Treinamento */}
            {trainingStatus && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    color: trainingStatus.includes('sucesso') ? '#52c41a' : '#ff4d4f'
                }}>
                    <p>{trainingStatus}</p>
                </div>
            )}

            {connectionError && (
                <div style={{
                    padding: '1rem',
                    backgroundColor: '#fff2f0',
                    border: '1px solid #ffccc7',
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    <p style={{ color: '#ff4d4f', margin: 0 }}>
                        Erro de conexão com o servidor!
                    </p>
                </div>
            )}
        </div>
    );
}

export default App;
