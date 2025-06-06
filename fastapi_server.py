from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from random import uniform
from time import time
import numpy as np
import os
import shutil
from datetime import datetime
from pathlib import Path
import socket

app = FastAPI(title="Servidor de Monitoramento de Tremores",
             description="API para monitoramento de tremores sísmicos usando ESP32")

# Configurar CORS para permitir requisies do frontend e do ESP32
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitindo todas as origens durante o desenvolvimento
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurações globais
MODELS_DIR = Path("models")
DATASET_DIR = Path("datasets/ac")
SAMPLE_RATE = 200  # Hz
SAMPLE_TIME = 0.5  # seconds
SAMPLES_PER_FILE = int(SAMPLE_RATE * SAMPLE_TIME)
ESP32_HOSTNAME = "sensor_tremores-01.local"

# Variáveis de estado
is_capturing = False
capture_count = {"normal": 0, "anomalia": 0}
last_sensor_data = None
last_sensor_time = 0
current_model_name = None
current_model_info = None

def resolve_mdns_hostname(hostname):
    """Resolve mDNS hostname to IP address"""
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return None

@app.on_event("startup")
async def startup_event():
    """Verificar conectividade com o ESP32 na inicialização"""
    esp32_ip = resolve_mdns_hostname(ESP32_HOSTNAME)
    if esp32_ip:
        print(f"ESP32 encontrado em: {esp32_ip}")
    else:
        print(f"Aviso: Não foi possível resolver o hostname {ESP32_HOSTNAME}")

    # Criar diretórios necessários
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATASET_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def root():
    """Endpoint raiz com informações sobre o servidor"""
    esp32_ip = resolve_mdns_hostname(ESP32_HOSTNAME)
    return {
        "status": "online",
        "sensor_hostname": ESP32_HOSTNAME,
        "sensor_ip": esp32_ip,
        "sensor_connected": esp32_ip is not None
    }

@app.get("/status")
async def status():
    """Endpoint de status do servidor"""
    esp32_ip = resolve_mdns_hostname(ESP32_HOSTNAME)
    return {
        "status": "online",
        "sensor_hostname": ESP32_HOSTNAME,
        "sensor_ip": esp32_ip,
        "sensor_connected": esp32_ip is not None
    }

# Variáveis de estado para captura
is_capturing = False
capture_count = {"normal": 0, "anomalia": 0}
last_sensor_data = None
last_sensor_time = 0

@app.get("/data")
def get_sensor_data():
    """Retorna dados do sensor com maior precisão"""
    global is_capturing, capture_count, last_sensor_data, last_sensor_time

    current_time = time()
    time_diff = current_time - last_sensor_time

    # Recebendo e processando dados do sensor com maior precisão
    ax = uniform(-0.02, 0.02)
    ay = uniform(-0.02, 0.02)

    # Aplicando um fator de escala para melhor sensibilidade
    scale_factor = 2.0  # Aumenta a sensibilidade dos dados
    ax = ax * scale_factor
    ay = ay * scale_factor

    # Calculando aceleração total com maior precisão
    total_acceleration = np.sqrt(np.power(ax, 2) + np.power(ay, 2))

    # Dados processados com mais casas decimais
    last_sensor_data = {
        "timestamp": current_time,
        "ax": round(ax, 6),  # Aumentando precisão decimal
        "ay": round(ay, 6),
        "acceleration_xy": round(total_acceleration, 6),
        "raw_x": ax,  # Mantendo dados brutos para processamento
        "raw_y": ay
    }

    # Se estiver em modo de captura, processa e salva os dados
    if is_capturing:
        folder = "anomalia" if total_acceleration >= 0.015 else "normal"
        folder_path = DATASET_DIR / folder
        folder_path.mkdir(parents=True, exist_ok=True)

        # Salvando dados com mais informações
        data = np.array([
            [ax, ay, total_acceleration]
            for _ in range(SAMPLES_PER_FILE)
        ])

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")  # Incluindo microssegundos
        filename = f"sensor_data_{timestamp}.csv"
        file_path = folder_path / filename

        np.savetxt(file_path, data, delimiter=",", fmt='%.6f')  # Salvando com 6 casas decimais
        capture_count[folder] += 1

    return last_sensor_data

@app.get("/sensor-status")
async def get_sensor_status():
    """Verifica status atual do sensor"""
    current_time = time()
    if last_sensor_time == 0:
        return {"status": "offline", "last_seen": None}

    time_diff = current_time - last_sensor_time
    return {
        "status": "online" if time_diff < 5 else "offline",
        "last_seen": last_sensor_time,
        "time_diff": time_diff
    }

@app.post("/start-capture")
async def start_capture():
    """Inicia o processo de captura de dados"""
    global is_capturing, capture_count
    try:
        # Reset estado de captura
        is_capturing = True
        capture_count = {"normal": 0, "anomalia": 0}

        # Backup modelo existente se houver
        if os.path.exists(MODELS_DIR / "mahalanobis_model.npz"):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = MODELS_DIR / f"mahalanobis_model_{timestamp}.npz"
            shutil.move(MODELS_DIR / "mahalanobis_model.npz", backup_path)

        # Limpar e criar diretórios de dados
        for subdir in ["normal", "anomalia"]:
            dir_path = DATASET_DIR / subdir
            if dir_path.exists():
                shutil.rmtree(dir_path)
            dir_path.mkdir(parents=True, exist_ok=True)

        return {"message": "Captura de dados iniciada. Os diretórios foram preparados."}
    except Exception as e:
        is_capturing = False
        capture_count = {"normal": 0, "anomalia": 0}
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop-capture")
async def stop_capture():
    """Para o processo de captura de dados"""
    global is_capturing
    is_capturing = False
    return {"message": "Captura de dados finalizada."}

@app.get("/capture-status")
async def get_capture_status():
    """Retorna o status atual da captura"""
    try:
        return {
            "normal_samples": capture_count["normal"],
            "anomaly_samples": capture_count["anomalia"],
            "ready_for_training": capture_count["normal"] >= 30 and capture_count["anomalia"] >= 30,
            "is_capturing": is_capturing
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train")
async def train_model():
    """Endpoint para treinar o modelo"""
    try:
        from analysis import train_and_evaluate

        # Treinar modelo
        model, cv_scores = train_and_evaluate()

        # Gerar nome único para o modelo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_filename = f"mahalanobis_model_{timestamp}.npz"
        model_path = MODELS_DIR / model_filename

        # Salvar o modelo
        np.savez(model_path,
                 covariance=model.covariance_,
                 location=model.location_,
                 scores=cv_scores)

        return {
            "status": "success",
            "model_name": model_filename,
            "cv_scores": cv_scores.tolist(),
            "mean_score": cv_scores.mean(),
            "std_score": cv_scores.std()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro no treinamento: {str(e)}"
        )

@app.post("/train-model")
async def train_model(model_name: str = Query(..., description="Nome do modelo a ser treinado")):
    """Treina o modelo com o nome especificado"""
    global current_model_name, current_model_info
    try:
        if not model_name:
            raise HTTPException(status_code=400, detail="Nome do modelo é obrigatório")

        # Importar funções de treinamento
        from analysis import prepare_dataset, train_and_evaluate

        # Treinar modelo
        clf, cv_scores = train_and_evaluate()

        # Criar metadata do modelo
        model_info = {
            "name": model_name,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "normal_samples": capture_count["normal"],
            "anomaly_samples": capture_count["anomalia"],
            "cv_scores": cv_scores.tolist(),
            "mean_score": float(cv_scores.mean()),
            "std_score": float(cv_scores.std())
        }

        # Salvar modelo com metadata
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_filename = f"{model_name.lower().replace(' ', '_')}_{timestamp}"
        model_path = MODELS_DIR / f"{model_filename}.npz"

        np.savez(model_path,
                 model=clf,
                 metadata=model_info)

        # Atualizar modelo atual
        current_model_name = model_name
        current_model_info = model_info

        # Gerar código para ESP32
        esp32_code = generate_esp32_code(clf, model_name)
        esp32_path = MODELS_DIR.parent / "esp32" / f"anomaly_inference_{model_filename}.ino"
        esp32_path.write_text(esp32_code)

        return {
            "message": f"Modelo '{model_name}' treinado com sucesso",
            "model_info": model_info,
            "esp32_code": esp32_path.name
        }
    except Exception as e:
        import traceback
        print("Erro no treinamento:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

def generate_esp32_code(clf, model_name):
    """Gera código Arduino para ESP32 com o modelo treinado"""
    # Template do código
    code_template = f"""
// Modelo gerado automaticamente para: {model_name}
// Data: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

// Parâmetros do modelo
const float MODEL_WEIGHTS[2] = {{{clf.coef_[0][0]:.6f}, {clf.coef_[0][1]:.6f}}};
const float MODEL_INTERCEPT = {clf.intercept_[0]:.6f};

bool checkAnomaly(float ax, float ay) {{
    // Calcula a probabilidade usando o modelo
    float score = ax * MODEL_WEIGHTS[0] + ay * MODEL_WEIGHTS[1] + MODEL_INTERCEPT;
    return score > 0; // threshold para classificação
}}
"""
    return code_template

@app.get("/current-model")
async def get_current_model():
    """Retorna informações sobre o modelo atual"""
    if current_model_info:
        return current_model_info
    return {"message": "Nenhum modelo carregado"}

@app.get("/list-models")
async def list_models():
    """Lista todos os modelos salvos"""
    models = []
    for model_file in MODELS_DIR.glob("*.npz"):
        try:
            with np.load(model_file) as data:
                if 'metadata' in data:
                    models.append(data['metadata'].item())
        except Exception:
            continue
    return {"models": models}
