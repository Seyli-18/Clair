import json
import mimetypes
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT
DATA_FILE = ROOT / "tasks.json"
MAX_BODY_SIZE = 1_000_000
VALID_PRIORITIES = {"basse", "normale", "haute"}
TASK_ID_PATTERN = re.compile(r"^[a-f0-9-]{36}$")


def load_tasks():
    if not DATA_FILE.exists():
        return []
    try:
        with DATA_FILE.open(encoding="utf-8") as data_file:
            tasks = json.load(data_file)
    except (json.JSONDecodeError, OSError) as error:
        raise RuntimeError(f"Impossible de lire {DATA_FILE.name}: {error}") from error
    if not isinstance(tasks, list):
        raise RuntimeError(f"{DATA_FILE.name} doit contenir une liste de tâches.")
    return tasks


def save_tasks(tasks):
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=ROOT,
            delete=False,
            suffix=".tmp",
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(tasks, temporary_file, ensure_ascii=False, indent=2)
            temporary_file.write("\n")
        os.replace(temporary_path, DATA_FILE)
    except OSError as error:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()
        raise RuntimeError(f"Impossible d'enregistrer les tâches: {error}") from error


class TaskRequestHandler(BaseHTTPRequestHandler):
    server_version = "Clair/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            raise ValueError("En-tête Content-Length invalide.") from None
        if length < 0 or length > MAX_BODY_SIZE:
            raise ValueError("La requête est trop volumineuse.")
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("Le corps doit être un JSON valide.") from None
        if not isinstance(payload, dict):
            raise ValueError("Le corps JSON doit être un objet.")
        return payload

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/tasks":
            try:
                self.send_json(200, {"tasks": load_tasks()})
            except RuntimeError as error:
                self.send_json(500, {"error": str(error)})
            return

        if path == "/api/stats":
            try:
                tasks = load_tasks()
                completed = sum(task.get("completed") is True for task in tasks)
                self.send_json(
                    200,
                    {
                        "total": len(tasks),
                        "completed": completed,
                        "remaining": len(tasks) - completed,
                    },
                )
            except RuntimeError as error:
                self.send_json(500, {"error": str(error)})
            return

        static_files = {
            "/": "index.html",
            "/index.html": "index.html",
            "/styles.css": "styles.css",
            "/app.js": "app.js",
        }
        filename = static_files.get(path)
        if filename is None:
            self.send_json(404, {"error": "Ressource introuvable."})
            return

        file_path = PUBLIC_DIR / filename
        try:
            body = file_path.read_bytes()
        except OSError as error:
            self.send_json(500, {"error": f"Impossible de lire {filename}: {error}"})
            return
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != "/api/tasks":
            self.send_json(404, {"error": "Ressource introuvable."})
            return
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        title = payload.get("title")
        description = payload.get("description", "")
        priority = payload.get("priority", "normale")
        if not isinstance(title, str) or not title.strip():
            self.send_json(400, {"error": "Le titre est obligatoire."})
            return
        if len(title.strip()) > 120:
            self.send_json(400, {"error": "Le titre ne peut pas dépasser 120 caractères."})
            return
        if not isinstance(description, str) or len(description) > 500:
            self.send_json(400, {"error": "La description ne peut pas dépasser 500 caractères."})
            return
        if not isinstance(priority, str) or priority not in VALID_PRIORITIES:
            self.send_json(400, {"error": "La priorité doit être basse, normale ou haute."})
            return

        try:
            tasks = load_tasks()
            task = {
                "id": str(uuid.uuid4()),
                "title": title.strip(),
                "description": description.strip(),
                "priority": priority,
                "completed": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            tasks.insert(0, task)
            save_tasks(tasks)
        except RuntimeError as error:
            self.send_json(500, {"error": str(error)})
            return
        self.send_json(201, {"task": task})

    def do_PATCH(self):
        task_id = self.task_id_from_path()
        if task_id is None:
            return
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return
        if not payload or any(key not in {"title", "description", "priority", "completed"} for key in payload):
            self.send_json(400, {"error": "Aucun champ valide à modifier."})
            return
        if "title" in payload and (
            not isinstance(payload["title"], str)
            or not payload["title"].strip()
            or len(payload["title"].strip()) > 120
        ):
            self.send_json(400, {"error": "Le titre doit contenir entre 1 et 120 caractères."})
            return
        if "description" in payload and (
            not isinstance(payload["description"], str) or len(payload["description"]) > 500
        ):
            self.send_json(400, {"error": "La description ne peut pas dépasser 500 caractères."})
            return
        if "priority" in payload and (
            not isinstance(payload["priority"], str)
            or payload["priority"] not in VALID_PRIORITIES
        ):
            self.send_json(400, {"error": "La priorité doit être basse, normale ou haute."})
            return
        if "completed" in payload and not isinstance(payload["completed"], bool):
            self.send_json(400, {"error": "Le statut completed doit être un booléen."})
            return

        try:
            tasks = load_tasks()
            task = next((item for item in tasks if item.get("id") == task_id), None)
            if task is None:
                self.send_json(404, {"error": "Tâche introuvable."})
                return
            for key, value in payload.items():
                task[key] = value.strip() if key in {"title", "description"} else value
            save_tasks(tasks)
        except RuntimeError as error:
            self.send_json(500, {"error": str(error)})
            return
        self.send_json(200, {"task": task})

    def do_DELETE(self):
        task_id = self.task_id_from_path()
        if task_id is None:
            return
        try:
            tasks = load_tasks()
            remaining_tasks = [task for task in tasks if task.get("id") != task_id]
            if len(remaining_tasks) == len(tasks):
                self.send_json(404, {"error": "Tâche introuvable."})
                return
            save_tasks(remaining_tasks)
        except RuntimeError as error:
            self.send_json(500, {"error": str(error)})
            return
        self.send_response(204)
        self.end_headers()

    def task_id_from_path(self):
        match = re.fullmatch(r"/api/tasks/([^/]+)", urlparse(self.path).path)
        if match is None or TASK_ID_PATTERN.fullmatch(match.group(1)) is None:
            self.send_json(404, {"error": "Tâche introuvable."})
            return None
        return match.group(1)

    def log_message(self, format_string, *args):
        print(f"{self.address_string()} - {format_string % args}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    try:
        load_tasks()
    except RuntimeError as error:
        raise SystemExit(str(error)) from error
    server = ThreadingHTTPServer(("127.0.0.1", port), TaskRequestHandler)
    print(f"Clair est disponible sur http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt de Clair.")
    finally:
        server.server_close()
