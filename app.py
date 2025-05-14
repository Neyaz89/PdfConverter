from flask import Flask, request, send_file, render_template, redirect, url_for, flash
import os
import uuid
import threading
import time
from werkzeug.utils import secure_filename
import img2pdf
import subprocess
import pikepdf
from io import BytesIO
import zipfile

app = Flask(__name__)
app.secret_key = "supersecretkey"

UPLOAD_FOLDER = "uploads"
CONVERTED_FOLDER = "converted"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")

def convert_with_libreoffice(input_path, output_dir):
    try:
        subprocess.run([
            "soffice", "--headless", "--convert-to", "pdf", "--outdir", output_dir, input_path
        ], check=True)
        base = os.path.splitext(os.path.basename(input_path))[0]
        return os.path.join(output_dir, f"{base}.pdf")
    except subprocess.CalledProcessError as e:
        raise Exception("LibreOffice conversion failed") from e

@app.route("/convert", methods=["POST"])
def convert_file():
    file = request.files.get("file")
    if not file or file.filename == "":
        return "No file uploaded", 400

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
            output_path = file_path
        else:
            return "Unsupported file type", 400

        return send_file(output_path, as_attachment=True, download_name="converted.pdf")

    except Exception as e:
        print("Conversion error:", e)
        return "Error converting file", 500

    finally:
        try: os.remove(file_path)
        except: pass

@app.route("/merge", methods=["POST"])
def merge_pdfs():
    files = request.files.getlist("files")
    pdf_paths = []

    for file in files:
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit(".", 1)[-1].lower()
        file_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
        file.save(file_path)

        if file_ext in ["pdf"]:
            pdf_paths.append(file_path)
        elif file_ext in ["jpg", "jpeg", "png"]:
            temp_pdf = os.path.join(CONVERTED_FOLDER, f"{uuid.uuid4()}.pdf")
            with open(temp_pdf, "wb") as f:
                f.write(img2pdf.convert(file_path))
            pdf_paths.append(temp_pdf)
        elif file_ext in ["docx", "pptx", "xlsx"]:
            temp_pdf = convert_with_libreoffice(file_path, CONVERTED_FOLDER)
            pdf_paths.append(temp_pdf)
        else:
            continue

    merged_pdf_path = os.path.join(CONVERTED_FOLDER, f"{uuid.uuid4()}_merged.pdf")
    merged = pikepdf.Pdf.new()

    for path in pdf_paths:
        try:
            src = pikepdf.Pdf.open(path)
            merged.pages.extend(src.pages)
        except Exception as e:
            print(f"Error merging {path}: {e}")

    merged.save(merged_pdf_path)
    return send_file(merged_pdf_path, as_attachment=True, download_name="merged.pdf")

# Cleanup
def cleanup_folder(folder, max_age=300):
    while True:
        now = time.time()
        for filename in os.listdir(folder):
            path = os.path.join(folder, filename)
            if os.path.isfile(path) and (now - os.path.getmtime(path)) > max_age:
                try: os.remove(path)
                except Exception as e: print(f"Cleanup error: {e}")
        time.sleep(60)

threading.Thread(target=cleanup_folder, args=(UPLOAD_FOLDER,), daemon=True).start()
threading.Thread(target=cleanup_folder, args=(CONVERTED_FOLDER,), daemon=True).start()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)), debug=True)
