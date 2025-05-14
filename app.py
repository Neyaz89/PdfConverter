from flask import Flask, request, send_file, render_template, redirect, url_for, flash
import os
import uuid
import threading
import time
from werkzeug.utils import secure_filename
import img2pdf
import subprocess
from fpdf import FPDF
from pdf2image import convert_from_path
from pdf2docx import Converter
from PIL import Image

app = Flask(__name__)
app.secret_key = "supersecretkey"

UPLOAD_FOLDER = "uploads"
CONVERTED_FOLDER = "converted"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

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

@app.route("/convert", methods=["POST"])
def convert_file():
    if "file" not in request.files or "conversion_type" not in request.form:
        flash("File or conversion type missing.")
        return redirect(url_for("index"))

    file = request.files["file"]
    conversion_type = request.form["conversion_type"]
    if file.filename == "":
        flash("No file selected.")
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    file_ext = filename.rsplit(".", 1)[-1].lower()
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    try:
        output_filename = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(CONVERTED_FOLDER, output_filename)

        # TEXT to PDF
        if conversion_type == "text-to-pdf":
            text = file.read().decode("utf-8")
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Arial", size=12)
            for line in text.split("\n"):
                pdf.cell(200, 10, txt=line, ln=True)
            pdf.output(output_path)
            return send_file(output_path, as_attachment=True, download_name="converted.pdf")

        # IMAGE to PDF
        elif conversion_type == "image-to-pdf":
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(file_path))
            return send_file(output_path, as_attachment=True, download_name="converted.pdf")

        # DOCX, PPTX to PDF
        elif conversion_type in ["docx-to-pdf", "pptx-to-pdf"]:
            output_path = convert_with_libreoffice(file_path, CONVERTED_FOLDER)
            return send_file(output_path, as_attachment=True, download_name="converted.pdf")

        # PDF to JPG
        elif conversion_type == "pdf-to-jpg":
            images = convert_from_path(file_path)
            image_path = os.path.join(CONVERTED_FOLDER, f"{uuid.uuid4()}.jpg")
            images[0].save(image_path, "JPEG")
            return send_file(image_path, as_attachment=True, download_name="converted.jpg")

        # PDF to DOCX
        elif conversion_type == "pdf-to-docx":
            output_path = os.path.join(CONVERTED_FOLDER, f"{uuid.uuid4()}.docx")
            cv = Converter(file_path)
            cv.convert(output_path, start=0, end=None)
            cv.close()
            return send_file(output_path, as_attachment=True, download_name="converted.docx")

        # Default - unsupported
        else:
            flash("Unsupported conversion type.")
            return redirect(url_for("index"))

    except Exception as e:
        print("Conversion error:", e)
        flash("Error converting file. Please try again.")
        return redirect(url_for("index"))

    finally:
        try:
            os.remove(file_path)
        except:
            pass

# Cleanup old files
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

threading.Thread(target=cleanup_folder, args=(UPLOAD_FOLDER,), daemon=True).start()
threading.Thread(target=cleanup_folder, args=(CONVERTED_FOLDER,), daemon=True).start()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)), debug=True)
