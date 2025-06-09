# Sistema de Detecção de Anomalias com Edge AI
### Edge Computing e Machine Learning para Detecção de Vibrações Anômalas

Sistema inteligente para detecção de anomalias em tempo real utilizando Edge Computing e Machine Learning. O projeto combina sensores de precisão com processamento local e análise avançada de dados para identificar padrões anormais de vibração. Desenvolvido para a disciplina *PHYSICAL COMPUTING, ROBOTICS & COGNITIVE IOT* – FIAP 2025.

🎥 [Assista à demonstração do projeto](https://youtu.be/ptv8GKg4S24)

## 🚀 Principais Características

- Detecção em tempo real com Edge Computing
- Machine Learning para identificação de padrões
- Análise multi-dimensional de vibrações
- Dashboard interativo para monitoramento
- Sistema distribuído com processamento local e em nuvem

![Carrossel GIF](https://raw.githubusercontent.com/…/img/carrossel.gif)

## 🛠️ Tecnologias e Componentes

### Hardware
- ESP32 (Processamento Edge)
- MPU6050 (Acelerômetro 3-eixos + Giroscópio)
- BMP085 (Sensor de pressão - complementar)

### Software
- **Edge:** C++ (Arduino Framework)
- **Backend:** Python FastAPI
- **Frontend:** React.js com visualização em tempo real
- **ML:** Algoritmos de detecção de anomalias (Mahalanobis Distance)
- **Análise:** Bibliotecas NumPy e Pandas

## 🧠 Funcionamento

1. **Coleta de Dados:**
   - Taxa de amostragem: 200Hz
   - Buffer de 200 amostras por ciclo
   - Normalização em tempo real

2. **Processamento Edge:**
   - Pré-processamento local
   - Cálculo de features dimensionais
   - Detecção primária de anomalias

3. **Análise Avançada:**
   - Modelo Mahalanobis para detecção de outliers
   - Análise multi-dimensional dos dados
   - Sistema de pontuação de anomalias

## ⚙️ Configurações

- **Rede:** Wi-Fi com conexão direta ao backend
- **API:** Porta 8005 (configurável)
- **Sensibilidade:** Ajustável via dashboard
- **Armazenamento:** Local e em nuvem

## 🚀 Execução

### Backend
```bash
uvicorn fastapi_server:app --port 8005 --reload
```

### Frontend
```bash
cd app-monitoramento
npm install
npm start
```

### Dispositivo
- Carregar o código via Arduino IDE
- Configurar WiFi e endpoint no arquivo de configuração

## 👥 Equipe

- André Rovai Andrade Xavier Junior – RM555848@fiap.com.br
- Alan de Souza Maximiano da Silva – RM557088@fiap.com.br
- Leonardo Zago Garcia Ferreira – RM558691@fiap.com.br

## 📝 Licença

Este projeto está sob a licença MIT. Consulte o arquivo LICENSE para mais detalhes.
