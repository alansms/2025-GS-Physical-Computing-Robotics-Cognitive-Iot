# Importando bibliotecas necessárias
import numpy as np
from sklearn.covariance import EllipticEnvelope
from sklearn.model_selection import cross_val_score
from pathlib import Path

def prepare_dataset():
    """Prepara o dataset para treinamento"""
    try:
        dataset_dir = Path("datasets/ac")

        # Configuração dos diretórios
        NORMAL_OPS = ["silent_0_baseline"]
        ANOMALY_OPS = ["medium_0", "high_0", "silent_1", "medium_1", "high_1"]

        # Carregar dados normais
        normal_data = []
        for op in NORMAL_OPS:
            op_dir = dataset_dir / op
            if not op_dir.exists():
                print(f"Aviso: Diretório {op_dir} não encontrado")
                continue

            for file in op_dir.glob("*.csv"):
                try:
                    data = np.loadtxt(file, delimiter=",")
                    if data.shape[1] >= 2:
                        normal_data.append(data[:, :2])
                except Exception as e:
                    print(f"Aviso: Erro ao carregar arquivo {file}: {str(e)}")
                    continue

        # Carregar dados de anomalia
        anomaly_data = []
        for op in ANOMALY_OPS:
            op_dir = dataset_dir / op
            if not op_dir.exists():
                print(f"Aviso: Diretório {op_dir} não encontrado")
                continue

            for file in op_dir.glob("*.csv"):
                try:
                    data = np.loadtxt(file, delimiter=",")
                    if data.shape[1] >= 2:
                        anomaly_data.append(data[:, :2])
                except Exception as e:
                    print(f"Aviso: Erro ao carregar arquivo {file}: {str(e)}")
                    continue

        if not normal_data:
            raise ValueError("Nenhum dado normal válido encontrado")
        if not anomaly_data:
            raise ValueError("Nenhum dado de anomalia válido encontrado")

        # Concatenar todos os dados
        X_normal = np.vstack(normal_data)
        X_anomaly = np.vstack(anomaly_data)

        # Criar labels (0 para normal, 1 para anomalia)
        y_normal = np.zeros(X_normal.shape[0])
        y_anomaly = np.ones(X_anomaly.shape[0])

        return X_normal, X_anomaly, y_normal, y_anomaly

    except Exception as e:
        print(f"Erro crítico no prepare_dataset: {str(e)}")
        raise

def train_and_evaluate():
    """Treina o modelo e avalia sua performance"""
    try:
        # Preparar dataset
        X_normal, X_anomaly, y_normal, y_anomaly = prepare_dataset()

        if X_normal.shape[0] == 0 and X_anomaly.shape[0] == 0:
            raise ValueError("Dataset vazio")

        # Concatenar dados normais e de anomalia para treinamento
        X = np.vstack([X_normal, X_anomaly])
        y = np.hstack([y_normal, y_anomaly])

        # Criar e treinar o modelo
        clf = EllipticEnvelope(contamination=0.1, random_state=42)
        clf.fit(X)

        # Calcular scores de validação cruzada
        cv_scores = cross_val_score(clf, X, y, cv=5)

        return clf, cv_scores

    except Exception as e:
        print(f"Erro no treinamento: {str(e)}")
        raise
