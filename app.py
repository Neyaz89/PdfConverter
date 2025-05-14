from flask import Flask, request, send_file, render_template, redirect, url_for, flash
import os
import uuid
import threading
import time
from werkzeug.utils import secure_filename
import img2pdf
import subprocess

app = Flask(__name__)
app.secret_key = "supersecretkey"  # Required for flash messages

UPLOAD_FOLDER = "uploads"
CONVERTED_FOLDER = "converted"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

# Serve index.html
@app.route("/")
def index():
    return render_template("index.html")

# LibreOffice conversion helper
def convert_with_libreoffice(input_path, output_dir):
    try:
        subprocess.run([
            "soffice", "--headless", "--convert-to", "pdf", "--outdir", output_dir, input_path
        ], check=True)
        base = os.path.splitext(os.path.basename(input_path))[0]
        return os.path.join(output_dir, f"{base}.pdf")
    except subprocess.CalledProcessError as e:
        raise Exception("LibreOffice conversion failed") from e

# File conversion route
@app.route("/convert", methods=["POST"])
def convert_file():
    if "file" not in request.files:
        flash("No file uploaded.")
        return redirect(url_for("index"))

    file = request.files["file"]
    if file.filename == "":
        flash("No file selected.")
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    file_ext = filename.rsplit(".", 1)[-1].lower()
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    try:
        if file_ext in ["jpg", "jpeg", "png"]:
            output_filename = f"{uuid.uuid4()}.pdf"
            output_path = os.path.join(CONVERTED_FOLDER, output_filename)
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(file_path))

        elif file_ext in ["docx", "pptx", "xlsx"]:
            output_path = convert_with_libreoffice(file_path, CONVERTED_FOLDER)

        elif file_ext == "pdf":
            return send_file(file_path, as_attachment=True, download_name="converted.pdf")

        else:
            flash("Unsupported file type.")
            return redirect(url_for("index"))

        return send_file(output_path, as_attachment=True, download_name="converted.pdf")

    except Exception as e:
        print("Conversion error:", e)
        flash("Error converting file. Please try again.")
        return redirect(url_for("index"))

    finally:
        try:
            os.remove(file_path)
        except:
            pass

# Background thread to delete old files
def cleanup_folder(folder, max_age_seconds=300):
    while True:
        now = time.time()
        for filename in os.listdir(folder):
            path = os.path.join(folder, filename)
            if os.path.isfile(path) and (now - os.path.getmtime(path)) > max_age_seconds:
                try:
                    os.remove(path)
                    print(f"Deleted old file: {path}")
                except Exception as e:
                    print(f"Failed to delete {path}: {e}")
        time.sleep(60)

# Start cleanup threads
threading.Thread(target=cleanup_folder, args=(UPLOAD_FOLDER,), daemon=True).start()
threading.Thread(target=cleanup_folder, args=(CONVERTED_FOLDER,), daemon=True).start()

# Render-friendly start
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)), debug=True)
