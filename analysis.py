# Importando bibliotecas necessárias
import numpy as np
from sklearn.covariance import EllipticEnvelope
from sklearn.model_selection import cross_val_score
from pathlib import Path

def prepare_dataset():
    """Prepara o dataset para treinamento"""
    try:
        dataset_dir = Path("datasets/ac")

        # Carregar dados normais
        normal_data = []
        normal_dir = dataset_dir / "normal"
        if not normal_dir.exists():
            raise FileNotFoundError(f"Diretório {normal_dir} não encontrado")

        for file in normal_dir.glob("*.csv"):
            try:
                data = np.loadtxt(file, delimiter=",")
                if data.shape[1] >= 2:  # Garantir que tem pelo menos 2 colunas
                    normal_data.append(data[:, :2])  # Pegando apenas ax e ay
            except Exception as e:
                print(f"Erro ao carregar arquivo {file}: {str(e)}")
                continue

        # Carregar dados de anomalia
        anomaly_data = []
        anomaly_dir = dataset_dir / "anomalia"
        if not anomaly_dir.exists():
            raise FileNotFoundError(f"Diretório {anomaly_dir} não encontrado")

        for file in anomaly_dir.glob("*.csv"):
            try:
                data = np.loadtxt(file, delimiter=",")
                if data.shape[1] >= 2:
                    anomaly_data.append(data[:, :2])
            except Exception as e:
                print(f"Erro ao carregar arquivo {file}: {str(e)}")
                continue

        if not normal_data or not anomaly_data:
            raise ValueError("Nenhum dado válido encontrado nas pastas normal/anomalia")

        # Concatenar todos os dados
        X_normal = np.vstack(normal_data)
        X_anomaly = np.vstack(anomaly_data)

        # Criar labels (0 para normal, 1 para anomalia)
        y_normal = np.zeros(X_normal.shape[0])
        y_anomaly = np.ones(X_anomaly.shape[0])

        # Combinar dados e labels
        X = np.vstack([X_normal, X_anomaly])
        y = np.hstack([y_normal, y_anomaly])

        return X, y

    except Exception as e:
        print(f"Erro ao preparar dataset: {str(e)}")
        raise

def train_and_evaluate():
    """Treina o modelo e avalia sua performance"""
    try:
        # Preparar dataset
        X, y = prepare_dataset()

        if X.shape[0] == 0:
            raise ValueError("Dataset vazio")

        # Criar e treinar o modelo
        clf = EllipticEnvelope(contamination=0.1, random_state=42)
        clf.fit(X)

        # Calcular scores de validação cruzada
        cv_scores = cross_val_score(clf, X, y, cv=5)

        return clf, cv_scores

    except Exception as e:
        print(f"Erro no treinamento: {str(e)}")
        raise
