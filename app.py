import os
import tempfile
from flask import Flask, request, render_template, send_file, redirect, url_for
from werkzeug.utils import secure_filename
from PIL import Image
import fitz  # PyMuPDF
from fpdf import FPDF
from docx import Document
from PyPDF2 import PdfReader, PdfWriter

app = Flask(__name__)
UPLOAD_FOLDER = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png'}
ALLOWED_DOCX_EXTENSIONS = {'docx'}
ALLOWED_PDF_EXTENSIONS = {'pdf'}


def allowed_file(filename, allowed_set):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_set


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/tool/<tool_name>')
def tool_page(tool_name):
    try:
        return render_template(f'{tool_name}.html')
    except:
        return "Tool page not found", 404


@app.route('/convert/jpg-to-pdf', methods=['POST'])
def jpg_to_pdf():
    files = request.files.getlist('files')
    images = []

    for file in files:
        if allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
            img = Image.open(file.stream).convert('RGB')
            images.append(img)

    if not images:
        return "No valid image files provided", 400

    output_path = os.path.join(UPLOAD_FOLDER, 'output.pdf')
    images[0].save(output_path, save_all=True, append_images=images[1:])
    return send_file(output_path, as_attachment=True, download_name='converted.pdf')


@app.route('/convert/pdf-to-jpg', methods=['POST'])
def pdf_to_jpg():
    file = request.files.get('file')
    if not file or not allowed_file(file.filename, ALLOWED_PDF_EXTENSIONS):
        return "Invalid PDF file", 400

    doc = fitz.open(stream=file.stream.read(), filetype='pdf')
    images = []

    for i in range(len(doc)):
        pix = doc[i].get_pixmap()
        output_path = os.path.join(UPLOAD_FOLDER, f'page_{i + 1}.jpg')
        pix.save(output_path)
        images.append(output_path)

    if not images:
        return "Conversion failed", 500

    # Return only first image as preview
    return send_file(images[0], as_attachment=True, download_name='page_1.jpg')


@app.route('/convert/docx-to-pdf', methods=['POST'])
def docx_to_pdf():
    file = request.files.get('file')
    if not file or not allowed_file(file.filename, ALLOWED_DOCX_EXTENSIONS):
        return "Invalid DOCX file", 400

    doc = Document(file)
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    for para in doc.paragraphs:
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.multi_cell(0, 10, para.text)

    output_path = os.path.join(UPLOAD_FOLDER, 'docx_output.pdf')
    pdf.output(output_path)
    return send_file(output_path, as_attachment=True, download_name='converted.pdf')


@app.route('/convert/pdf-to-docx', methods=['POST'])
def pdf_to_docx():
    file = request.files.get('file')
    if not file or not allowed_file(file.filename, ALLOWED_PDF_EXTENSIONS):
        return "Invalid PDF file", 400

    pdf = PdfReader(file.stream)
    doc = Document()

    for page in pdf.pages:
        text = page.extract_text()
        doc.add_paragraph(text if text else "[Blank Page]")

    output_path = os.path.join(UPLOAD_FOLDER, 'converted.docx')
    doc.save(output_path)
    return send_file(output_path, as_attachment=True, download_name='converted.docx')


@app.route('/convert/compress-pdf', methods=['POST'])
def compress_pdf():
    file = request.files.get('file')
    if not file or not allowed_file(file.filename, ALLOWED_PDF_EXTENSIONS):
        return "Invalid PDF file", 400

    reader = PdfReader(file.stream)
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    output_path = os.path.join(UPLOAD_FOLDER, 'compressed.pdf')
    with open(output_path, 'wb') as f:
        writer.write(f)

    return send_file(output_path, as_attachment=True, download_name='compressed.pdf')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(debug=True, host='0.0.0.0', port=port)
