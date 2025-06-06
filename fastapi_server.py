from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from random import uniform
from time import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/data")
def get_sensor_data():
    ax, ay, az = uniform(-0.02, 0.02), uniform(-0.02, 0.02), uniform(0.98, 1.02)
    total_acceleration = (ax**2 + ay**2 + az**2) ** 0.5
    anomaly = total_acceleration <= 0.98 or total_acceleration >= 1.01
    print(f"[DEBUG] ACC: {total_acceleration:.3f} | ANOMALY: {anomaly}")
    return {
        "timestamp": time(),
        "ax": ax,
        "ay": ay,
        "az": az,
        "acceleration": round(total_acceleration, 3),
        "anomaly": anomaly
    }