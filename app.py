from flask import Flask, render_template, request, send_file, jsonify
from werkzeug.utils import secure_filename
import os
import uuid
import subprocess
from PIL import Image
import img2pdf
from pdf2image import convert_from_path
from pdf2docx import Converter
from fpdf import FPDF

app = Flask(__name__)
app.secret_key = 'supersecretkey'

UPLOAD_FOLDER = 'uploads'
CONVERTED_FOLDER = 'converted'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

def convert_with_libreoffice(input_path, output_dir):
    try:
        subprocess.run([
            'soffice', '--headless', '--convert-to', 'pdf', '--outdir', output_dir, input_path
        ], check=True)
        base = os.path.splitext(os.path.basename(input_path))[0]
        return os.path.join(output_dir, f"{base}.pdf")
    except subprocess.CalledProcessError:
        raise Exception("LibreOffice conversion failed")

def text_to_pdf(text_file_path, output_pdf_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    with open(text_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for line in lines:
            pdf.cell(200, 10, txt=line.strip(), ln=True)

    pdf.output(output_pdf_path)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    file_ext = filename.rsplit('.', 1)[-1].lower()
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    try:
        if file_ext in ['jpg', 'jpeg', 'png']:
            output_filename = f"{uuid.uuid4()}.pdf"
            output_path = os.path.join(CONVERTED_FOLDER, output_filename)
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(file_path))
        elif file_ext in ['docx', 'pptx', 'xlsx']:
            output_path = convert_with_libreoffice(file_path, CONVERTED_FOLDER)
        elif file_ext == 'txt':
            output_filename = f"{uuid.uuid4()}.pdf"
            output_path = os.path.join(CONVERTED_FOLDER, output_filename)
            text_to_pdf(file_path, output_path)
        elif file_ext == 'pdf':
            return send_file(file_path, as_attachment=True, download_name="converted.pdf")
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        return send_file(output_path, as_attachment=True, download_name="converted.pdf")

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            os.remove(file_path)
        except:
            pass

@app.route('/pdf-to-jpg', methods=['POST'])
def pdf_to_jpg():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    try:
        images = convert_from_path(file_path)
        output_images = []
        for img in images:
            output_path = os.path.join(CONVERTED_FOLDER, f"{uuid.uuid4()}.jpg")
            img.save(output_path, 'JPEG')
            output_images.append(output_path)
        return send_file(output_images[0], as_attachment=True, download_name="converted.jpg")
    except Exception as e:
        return jsonify({'error': 'Failed to convert PDF to JPG'}), 500
    finally:
        try:
            os.remove(file_path)
        except:
            pass

@app.route('/pdf-to-docx', methods=['POST'])
def pdf_to_docx():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    output_filename = f"{uuid.uuid4()}.docx"
    output_path = os.path.join(CONVERTED_FOLDER, output_filename)

    try:
        cv = Converter(file_path)
        cv.convert(output_path, start=0, end=None)
        cv.close()
        return send_file(output_path, as_attachment=True, download_name="converted.docx")
    except Exception as e:
        return jsonify({'error': 'PDF to DOCX conversion failed'}), 500
    finally:
        try:
            os.remove(file_path)
        except:
            pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(debug=False, host='0.0.0.0', port=port)
