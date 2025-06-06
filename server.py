import json
import argparse
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler


class SensorDataHandler(BaseHTTPRequestHandler):
    """Handler for sensor data requests"""
    output_dir = "sensor_data"  # Default output directory

    def do_GET(self):
        """Return server ready status"""
        client_address = self.client_address[0]
        print(f"GET request from: {client_address}")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"1")  # Always ready to receive data

    def do_POST(self):
        """Handle incoming sensor data"""
        try:
            client_address = self.client_address[0]
            # Read and parse data
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length).decode("utf-8")
            sensor_data = json.loads(post_data)

            print(f"\nRecebendo dados do ESP32 ({client_address}):")
            print(f"X:{sensor_data['ax']:.6f} Y:{sensor_data['ay']:.6f} Z:{sensor_data['az']:.6f} | ACC_XY:{sensor_data['acceleration_xy']:.6f}")

            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = Path(self.output_dir) / f"sensor_data_{timestamp}.csv"

            # Save data to CSV
            self._save_data_to_csv(sensor_data, filepath)

            self.send_response(204)  # Success, no content to return
            print(f"Dados salvos em: {filepath}")

        except Exception as e:
            print(f"Erro ao processar dados do {client_address}: {str(e)}")
            self.send_response(500)

        self.end_headers()

    def _save_data_to_csv(self, data, filepath):
        """Save sensor data to CSV file"""
        # Create directory if it doesn't exist
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Write headers if this is the first write
        if not hasattr(self, 'headers_written'):
            with open(filepath, "w") as f:
                f.write("timestamp,ax,ay,az,acceleration_xy\n")
            self.headers_written = True

        # Append data
        with open(filepath, "a") as f:
            f.write(f"{data['timestamp']},{data['ax']},{data['ay']},{data['az']},{data['acceleration_xy']}\n")


def create_server(output_dir, port):
    """Create and configure the HTTP server"""
    SensorDataHandler.output_dir = output_dir  # Set output directory as class variable
    server_address = ('', port)
    return HTTPServer(server_address, SensorDataHandler)


def main():
    """Main entry point"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Sensor Data Collection Server")
    parser.add_argument(
        "-d",
        "--dir",
        type=str,
        default="sensor_data",
        help="Output directory for sensor data (default: sensor_data)",
    )
    parser.add_argument(
        "-p", "--port", type=int, default=8080, help="Server port (default: 8080)"
    )
    args = parser.parse_args()

    # Create and start server
    server = create_server(args.dir, args.port)

    # Print startup message
    print("\nSensor Data Collection Server")
    print(f"Saving data to: {args.dir}")
    print(f"Server running on port {args.port}")
    print("Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down...")
        server.server_close()


if __name__ == "__main__":
    main()
